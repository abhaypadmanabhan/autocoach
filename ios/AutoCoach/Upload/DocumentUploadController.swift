import Foundation
import SwiftUI
import Supabase
import UniformTypeIdentifiers

/// Local register body — kept in Upload/ because Networking/ is owned by another lane.
struct RegisterDocumentRequest: Codable, Sendable {
    let filename: String
    let file_path: String
    let file_type: String
    let file_size: Int
}

/// Upload flow phases (PRD §5.7).
enum UploadPhase: Equatable, Sendable {
    case picking
    case uploading
    case registering
    case processing
    case ready
    case failed
}

/// Designed failure surfaces — never a raw FastAPI `detail` string.
enum UploadFailure: Equatable, Sendable {
    case oversized(bytes: Int)
    case documentQuota
    case registerRejected(kind: RegisterRejectKind)
    case processingFailed
    case interrupted
    case generic

    enum RegisterRejectKind: Equatable, Sendable {
        case invalidType
        case invalidPath
        case mismatch
        case notFoundInStorage
        case other
    }

    var title: String {
        switch self {
        case .oversized: return "FILE TOO LARGE"
        case .documentQuota: return "DOCUMENT CREDITS"
        case .registerRejected: return "COULD NOT REGISTER"
        case .processingFailed: return "PROCESSING FAILED"
        case .interrupted: return "UPLOAD INTERRUPTED"
        case .generic: return "UPLOAD FAILED"
        }
    }

    var message: String {
        switch self {
        case .oversized:
            return "That file is over 20 MB."
        case .documentQuota:
            return "You can keep 2 documents. Delete one to add another."
        case .registerRejected(let kind):
            switch kind {
            case .invalidType: return "That file type is not supported. Choose a PDF or PPTX."
            case .invalidPath: return "The storage path was rejected. Try again."
            case .mismatch: return "The file type did not match the extension. Try again."
            case .notFoundInStorage: return "The file did not land in storage. Try uploading again."
            case .other: return "Registration failed. Try again."
            }
        case .processingFailed:
            return "We could not read that document. Try a different file."
        case .interrupted:
            return "The upload did not finish. Your document was not registered — try again."
        case .generic:
            return "Something went wrong. Try again."
        }
    }
}

/// `@MainActor` state machine for the Files → Storage → register → poll path.
@MainActor
@Observable
final class DocumentUploadController {
    private(set) var phase: UploadPhase = .picking
    private(set) var uploadProgress: Double = 0
    private(set) var failure: UploadFailure?
    private(set) var existingDocuments: [Document] = []
    private(set) var readyDocumentID: String?
    private(set) var pickedFilename: String?
    private(set) var oversizedDisplayBytes: Int?

    /// True while a delete-from-quota-list request is in flight.
    private(set) var isDeleting = false

    private let api: APIClient
    private let supabase: SupabaseClient
    private var flowTask: Task<Void, Never>?
    private var registeredDocumentID: String?
    private var wasBackgroundedDuringTransfer = false

    static let allowedContentTypes: [UTType] = {
        var types: [UTType] = [.pdf]
        if let pptx = UTType(filenameExtension: "pptx") {
            types.append(pptx)
        } else {
            // `importedAs:` is non-optional — it declares the type if the system
            // does not already know it — so this branch cannot use `if let`.
            types.append(UTType(importedAs: "org.openxmlformats.presentationml.presentation"))
        }
        return types
    }()

    init(api: APIClient, supabase: SupabaseClient) {
        self.api = api
        self.supabase = supabase
    }

    func cancelInFlight() {
        flowTask?.cancel()
        flowTask = nil
    }

    /// Scene-phase hook — backgrounding mid-transfer marks the run so a
    /// cancelled URLSession surfaces as a clean retry rather than a corrupt ready.
    func noteScenePhase(_ phase: ScenePhase) {
        switch phase {
        case .background, .inactive:
            if self.phase == .uploading || self.phase == .registering {
                wasBackgroundedDuringTransfer = true
            }
        case .active:
            break
        @unknown default:
            break
        }
    }

    func resetToPicking() {
        cancelInFlight()
        phase = .picking
        uploadProgress = 0
        failure = nil
        existingDocuments = []
        readyDocumentID = nil
        pickedFilename = nil
        oversizedDisplayBytes = nil
        registeredDocumentID = nil
        wasBackgroundedDuringTransfer = false
        isDeleting = false
    }

    func retry() {
        resetToPicking()
    }

    /// Start the full pipeline for a security-scoped file URL from `.fileImporter`.
    func start(with url: URL) {
        cancelInFlight()
        failure = nil
        readyDocumentID = nil
        registeredDocumentID = nil
        wasBackgroundedDuringTransfer = false
        uploadProgress = 0

        flowTask = Task { [weak self] in
            await self?.run(url: url)
        }
    }

    func deleteDocument(id: String) async {
        guard !isDeleting else { return }
        isDeleting = true
        defer { isDeleting = false }
        do {
            try await deleteDocumentHTTP(id: id)
            existingDocuments.removeAll { $0.id == id }
        } catch {
            // Keep quota UI up; surface a soft failure without raw detail.
            failure = .documentQuota
        }
    }

    // MARK: - Pipeline

    private func run(url: URL) async {
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }

        do {
            let filename = url.lastPathComponent
            pickedFilename = filename

            guard let fileType = Self.fileType(for: filename) else {
                // Picker should already filter; belt-and-suspenders.
                phase = .failed
                failure = .registerRejected(kind: .invalidType)
                return
            }

            let values = try url.resourceValues(forKeys: [.fileSizeKey])
            let size = values.fileSize ?? 0
            if size > StorageProgressUploader.maxBytes {
                phase = .failed
                failure = .oversized(bytes: size)
                oversizedDisplayBytes = size
                return
            }

            let data = try Data(contentsOf: url)
            if data.count > StorageProgressUploader.maxBytes {
                phase = .failed
                failure = .oversized(bytes: data.count)
                oversizedDisplayBytes = data.count
                return
            }

            let userId = try await currentUserID()
            let documentFolderID = UUID().uuidString.lowercased()
            let safeName = Self.sanitizedFilename(filename)
            let objectPath = "\(userId)/\(documentFolderID)/\(safeName)"

            phase = .uploading
            uploadProgress = 0
            try await StorageProgressUploader.upload(
                supabase: supabase,
                objectPath: objectPath,
                data: data,
                contentType: fileType.contentType,
                onProgress: { [weak self] fraction in
                    self?.uploadProgress = fraction
                }
            )
            try Task.checkCancellation()

            phase = .registering
            let registered = try await registerWithRetry(
                RegisterDocumentRequest(
                    filename: filename,
                    file_path: objectPath,
                    file_type: fileType.apiValue,
                    file_size: data.count
                )
            )
            registeredDocumentID = registered.id
            try Task.checkCancellation()

            phase = .processing
            let ready = try await pollUntilTerminal(documentID: registered.id)
            if ready.status == "failed" {
                phase = .failed
                failure = .processingFailed
                return
            }

            phase = .ready
            readyDocumentID = ready.id
        } catch is CancellationError {
            if wasBackgroundedDuringTransfer {
                phase = .failed
                failure = .interrupted
            } else if phase != .ready {
                phase = .failed
                failure = .interrupted
            }
        } catch let err as APIError {
            apply(apiError: err)
        } catch {
            if wasBackgroundedDuringTransfer {
                phase = .failed
                failure = .interrupted
            } else {
                phase = .failed
                failure = .generic
            }
        }
    }

    private func apply(apiError: APIError) {
        phase = .failed
        switch apiError {
        case .http(let status, let detail) where status == 413:
            let bytes = oversizedDisplayBytes ?? StorageProgressUploader.maxBytes + 1
            failure = .oversized(bytes: bytes)
            oversizedDisplayBytes = bytes
            _ = detail // never surface raw detail
        case .rateLimited(let detail):
            if Self.isDocumentQuota(detail) {
                failure = .documentQuota
                Task { await self.refreshDocumentsForQuota() }
            } else {
                // Unexpected: registerWithRetry should have swallowed limiter 429s.
                failure = .generic
            }
        case .http(let status, let detail) where status == 400:
            failure = .registerRejected(kind: Self.classifyRegister400(detail))
        case .unauthorized:
            failure = .generic
        case .network where wasBackgroundedDuringTransfer:
            failure = .interrupted
        default:
            failure = .generic
        }
    }

    private func registerWithRetry(_ body: RegisterDocumentRequest) async throws -> Document {
        var backoffNs: UInt64 = 1_000_000_000
        while true {
            try Task.checkCancellation()
            do {
                let doc: Document = try await api.post("/documents/register", body: body)
                return doc
            } catch let err as APIError {
                if case .rateLimited(let detail) = err, !Self.isDocumentQuota(detail) {
                    // Per-minute limiter — silent backoff, no user-facing error.
                    try await Task.sleep(nanoseconds: backoffNs)
                    backoffNs = min(backoffNs * 2, 8_000_000_000)
                    continue
                }
                if case .rateLimited(let detail) = err, Self.isDocumentQuota(detail) {
                    await refreshDocumentsForQuota()
                }
                throw err
            }
        }
    }

    private func pollUntilTerminal(documentID: String) async throws -> Document {
        var backoffNs: UInt64 = 1_000_000_000
        while true {
            try Task.checkCancellation()
            do {
                let doc: Document = try await api.get("/documents/\(documentID)")
                switch doc.status {
                case "ready", "failed":
                    return doc
                default:
                    try await Task.sleep(nanoseconds: 2_000_000_000)
                }
            } catch let err as APIError {
                if case .rateLimited(let detail) = err, !Self.isDocumentQuota(detail) {
                    try await Task.sleep(nanoseconds: backoffNs)
                    backoffNs = min(backoffNs * 2, 8_000_000_000)
                    continue
                }
                if case .network = err {
                    try await Task.sleep(nanoseconds: backoffNs)
                    backoffNs = min(backoffNs * 2, 8_000_000_000)
                    continue
                }
                throw err
            }
        }
    }

    private func refreshDocumentsForQuota() async {
        do {
            let list: DocumentListResponse = try await api.get("/documents/")
            existingDocuments = list.documents
        } catch {
            existingDocuments = []
        }
    }

    /// DELETE /documents/{id} — 204 No Content. Implemented locally because
    /// `APIClient` rejects empty success bodies (Networking/ is frozen for this lane).
    private func deleteDocumentHTTP(id: String) async throws {
        let session = try await supabase.auth.session
        let base = AppConfig.backendBaseURL
        let url = base.appending(path: "documents/\(id)")
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.network("Non-HTTP response on delete.")
        }
        if http.statusCode == 401 {
            try? await supabase.auth.refreshSession()
            let refreshed = try await supabase.auth.session
            request.setValue("Bearer \(refreshed.accessToken)", forHTTPHeaderField: "Authorization")
            let (_, retryResponse) = try await URLSession.shared.data(for: request)
            guard let retryHTTP = retryResponse as? HTTPURLResponse, retryHTTP.statusCode == 204 else {
                throw APIError.http(status: (retryResponse as? HTTPURLResponse)?.statusCode ?? 500, detail: "Delete failed.")
            }
            return
        }
        guard http.statusCode == 204 else {
            throw APIErrorDecoder.decode(status: http.statusCode, body: Data())
        }
    }

    private func currentUserID() async throws -> String {
        let session = try await supabase.auth.session
        return session.user.id.uuidString.lowercased()
    }

    // MARK: - Helpers

    private struct FileKind {
        let apiValue: String
        let contentType: String
    }

    private static func fileType(for filename: String) -> FileKind? {
        let ext = (filename as NSString).pathExtension.lowercased()
        switch ext {
        case "pdf": return FileKind(apiValue: "pdf", contentType: "application/pdf")
        case "pptx":
            return FileKind(
                apiValue: "pptx",
                contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            )
        default: return nil
        }
    }

    private static func sanitizedFilename(_ name: String) -> String {
        // Keep basename readable; strip path separators that would break object paths.
        name
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: "\\", with: "-")
            .replacingOccurrences(of: "..", with: ".")
    }

    private static func isDocumentQuota(_ detail: String) -> Bool {
        let lower = detail.lowercased()
        return lower.contains("document limit") || lower.contains("delete a document")
    }

    private static func classifyRegister400(_ detail: String) -> UploadFailure.RegisterRejectKind {
        let lower = detail.lowercased()
        if lower.contains("invalid file type") { return .invalidType }
        if lower.contains("invalid file path") { return .invalidPath }
        if lower.contains("mismatch") { return .mismatch }
        if lower.contains("not found in storage") { return .notFoundInStorage }
        return .other
    }
}
