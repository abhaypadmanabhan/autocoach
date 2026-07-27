import Foundation
import Supabase

/// Direct Supabase Storage upload with **real** URLSession byte progress.
///
/// supabase-swift 2.x `storage.upload` is fire-and-forget (no progress API yet;
/// StorageTransferTask lands in an unreleased major). The PRD requires a
/// determinate `ProgressHairline` driven by actual bytes sent, so this helper
/// posts to the Storage REST endpoint and observes `URLSessionTask` progress.
enum StorageProgressUploader {
    static let maxBytes = 20 * 1024 * 1024

    /// Upload `data` to bucket `documents` at `objectPath`.
    /// - Parameter onProgress: 0…1 fraction on the main actor.
    static func upload(
        supabase: SupabaseClient,
        objectPath: String,
        data: Data,
        contentType: String,
        onProgress: @MainActor @escaping (Double) -> Void
    ) async throws {
        let session = try await supabase.auth.session
        guard let supabaseURL = AppConfig.supabaseURL,
              let apiKey = AppConfig.supabaseKey
        else {
            throw APIError.configMissing("Supabase is not configured.")
        }

        let encodedPath = objectPath
            .split(separator: "/")
            .map {
                $0.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? String($0)
            }
            .joined(separator: "/")
        guard let url = URL(string: "\(supabaseURL.absoluteString)/storage/v1/object/documents/\(encodedPath)") else {
            throw APIError.network("Could not build Storage upload URL.")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue(apiKey, forHTTPHeaderField: "apikey")
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.setValue("false", forHTTPHeaderField: "x-upsert")
        request.timeoutInterval = 120

        let delegate = UploadProgressDelegate(onProgress: onProgress)
        let urlSession = URLSession(
            configuration: .default,
            delegate: delegate,
            delegateQueue: nil
        )
        defer { urlSession.finishTasksAndInvalidate() }

        let (responseData, response): (Data, URLResponse)
        do {
            (responseData, response) = try await urlSession.upload(for: request, from: data)
        } catch {
            // Invalidate immediately on failure so the delegate is released.
            urlSession.invalidateAndCancel()
            throw error
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.network("Storage returned a non-HTTP response.")
        }
        guard (200..<300).contains(http.statusCode) else {
            let detail = String(data: responseData, encoding: .utf8) ?? ""
            if http.statusCode == 413 || detail.localizedCaseInsensitiveContains("payload") {
                throw APIError.http(status: 413, detail: "File too large")
            }
            throw APIError.http(status: http.statusCode, detail: "Upload failed.")
        }
        await onProgress(1)
    }
}

/// Bridges URLSession byte callbacks into a MainActor progress closure.
private final class UploadProgressDelegate: NSObject, URLSessionTaskDelegate, Sendable {
    private let onProgress: @MainActor (Double) -> Void

    init(onProgress: @MainActor @escaping (Double) -> Void) {
        self.onProgress = onProgress
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        didSendBodyData bytesSent: Int64,
        totalBytesSent: Int64,
        totalBytesExpectedToSend: Int64
    ) {
        let expected = max(totalBytesExpectedToSend, 1)
        let fraction = min(1, max(0, Double(totalBytesSent) / Double(expected)))
        Task { @MainActor in
            onProgress(fraction)
        }
    }
}
