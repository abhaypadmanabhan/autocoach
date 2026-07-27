import Foundation

// MARK: - Routing

/// Push payload for `DocumentDetailView`.
///
/// `Document` itself is only `Codable`, not `Hashable`, and it lives in
/// `Networking/Models.swift` which this lane does not own — so the route carries
/// the two fields the destination needs before its own fetch lands, rather than
/// retrofitting `Hashable` onto the wire model.
struct DocumentRoute: Hashable, Sendable {
    let documentID: String
    let fallbackTitle: String
}

// MARK: - Local persistence

/// UserDefaults keys owned by the Library lane.
///
/// Two pieces of state genuinely have no backend home:
/// - the activation checklist's "came back on a second day", which is a local
///   engagement fact the API never records, and
/// - the daily-quiz-quota exhaustion flag, which the server communicates once,
///   in a 429, on a screen the user then leaves.
///
/// Both are day-stamped rather than boolean so they self-expire at midnight
/// instead of needing a clearing pass.
enum LibraryDefaults {
    static let firstSeenDay = "acx.library.firstSeenDay"
    static let activationComplete = "acx.library.activationComplete"
    static let quotaExhaustedDay = "acx.quota.exhaustedDay"
    static let quotaLimit = "acx.quota.limit"

    /// `2026-07-27` — a calendar day in the user's own timezone, no formatter.
    static func dayStamp(_ date: Date = Date()) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Records the daily-quota 429 so the Library can render a designed credits
    /// state instead of the user only ever seeing it once, mid-tap, on Detail.
    static func recordQuotaExhausted(limit: Int) {
        UserDefaults.standard.set(dayStamp(), forKey: quotaExhaustedDay)
        UserDefaults.standard.set(limit, forKey: quotaLimit)
    }

    static var isQuotaExhaustedToday: Bool {
        UserDefaults.standard.string(forKey: quotaExhaustedDay) == dayStamp()
    }
}

// MARK: - Activation checklist

/// The three-step "you are not set up yet" checklist (PRD §5.6).
///
/// Every item is **derived from real data**, never from a local "user tapped
/// the thing" flag, so it cannot claim progress the backend disagrees with:
/// - `hasDocument` — the account owns at least one document.
/// - `hasFinishedQuiz` — some document reports `concepts_practiced > 0`, which
///   is only ever written by a graded answer. A created-but-abandoned session
///   does not count, which is the honest reading of "finish a quiz".
/// - `hasReturned` — today is not the day this install first rendered Library.
struct ActivationChecklist: Equatable, Sendable {
    var hasDocument: Bool
    var hasFinishedQuiz: Bool
    var hasReturned: Bool

    var allDone: Bool { hasDocument && hasFinishedQuiz && hasReturned }
    var doneCount: Int { [hasDocument, hasFinishedQuiz, hasReturned].filter { $0 }.count }
    static let total = 3
}

// MARK: - Load phase

enum LibraryPhase: Equatable, Sendable {
    case loading
    case loaded
    case empty
    /// Transport failure — a distinct, designed screen from a server error.
    case offline(String)
    case failed(String)
}

// MARK: - Model

/// Library screen state (PRD §5.6).
///
/// `@MainActor` + `@Observable` mirrors ``QuizEngine`` / ``DocumentUploadController``:
/// mutations land on the main actor, and the polling `Task` inherits that
/// isolation so awaiting the `APIClient` actor suspends without tearing state.
@MainActor
@Observable
final class LibraryModel {
    private(set) var phase: LibraryPhase = .loading
    private(set) var documents: [Document] = []
    private(set) var progressByDocument: [String: DocumentProgress] = [:]
    private(set) var isDeleting = false
    var toast: ACXToast?

    private let api: APIClient
    /// `@ObservationIgnored` (a `Task` handle is not view state) + `nonisolated(unsafe)`,
    /// because `deinit` cancels it from a nonisolated context.
    @ObservationIgnored nonisolated(unsafe) private var pollTask: Task<Void, Never>?

    /// Poll cadence for `pending` / `processing` documents (PRD §5.6).
    private static let pollInterval: Duration = .seconds(2)

    init(api: APIClient) {
        self.api = api
    }

    deinit {
        pollTask?.cancel()
    }

    // MARK: Derived

    /// Concepts known for a document — progress is authoritative once it exists,
    /// because `concept_count` on the list row is not refreshed after extraction.
    func conceptCount(for doc: Document) -> Int? {
        progressByDocument[doc.id]?.concepts_total ?? doc.concept_count
    }

    func masteryPercent(for doc: Document) -> Int? {
        progressByDocument[doc.id]?.mastery_percent
    }

    var checklist: ActivationChecklist {
        ActivationChecklist(
            hasDocument: !documents.isEmpty,
            hasFinishedQuiz: progressByDocument.values.contains { $0.concepts_practiced > 0 },
            hasReturned: hasReturnedOnALaterDay
        )
    }

    /// Once every item has been satisfied the checklist is retired for good —
    /// it must not reappear because a user deleted their last document.
    var showsChecklist: Bool {
        if UserDefaults.standard.bool(forKey: LibraryDefaults.activationComplete) { return false }
        // Never flash the checklist over a screen that has not loaded yet.
        if phase == .loading { return false }
        if checklist.allDone {
            UserDefaults.standard.set(true, forKey: LibraryDefaults.activationComplete)
            return false
        }
        return true
    }

    private var hasReturnedOnALaterDay: Bool {
        guard let first = UserDefaults.standard.string(forKey: LibraryDefaults.firstSeenDay) else {
            return false
        }
        return first != LibraryDefaults.dayStamp()
    }

    /// Stamps the first day this install rendered Library. Called from `load`
    /// rather than lazily from the checklist getter, so nothing writes to
    /// `UserDefaults` in the middle of a view-body evaluation.
    private func seedFirstSeenDayIfNeeded() {
        guard UserDefaults.standard.string(forKey: LibraryDefaults.firstSeenDay) == nil else { return }
        UserDefaults.standard.set(LibraryDefaults.dayStamp(), forKey: LibraryDefaults.firstSeenDay)
    }

    private var needsPolling: Bool {
        documents.contains { $0.status == "pending" || $0.status == "processing" }
    }

    // MARK: Loading

    /// Full reload. `initial` drives the loading screen; a pull-to-refresh keeps
    /// the current list on screen instead of flashing a skeleton over it.
    func load(initial: Bool = false) async {
        seedFirstSeenDayIfNeeded()
        if initial && documents.isEmpty { phase = .loading }
        do {
            let resp: DocumentListResponse = try await api.get("/documents/")
            documents = resp.documents
            phase = resp.documents.isEmpty ? .empty : .loaded
        } catch {
            // A failed refresh must not blank a list the user can still read.
            if documents.isEmpty { phase = Self.classify(error) }
            else { toast = .error(Self.message(for: error)) }
            return
        }
        await loadProgress()
        startPollingIfNeeded()
    }

    /// Progress is a **second, independent** request: a 500 there must not cost
    /// the user their document list, so it degrades to "no mastery yet" instead
    /// of failing the screen.
    private func loadProgress() async {
        guard !documents.isEmpty else {
            progressByDocument = [:]
            return
        }
        guard let summary: DocumentProgressSummaryResponse =
                try? await api.get("/documents/progress/summary") else { return }
        progressByDocument = Dictionary(
            summary.documents.map { ($0.document_id, $0) },
            uniquingKeysWith: { first, _ in first }
        )
    }

    // MARK: Polling

    /// While any document is `pending` / `processing`, re-fetch every 2s so the
    /// row transitions to `ready` on its own (PRD §5.6 acceptance).
    func startPollingIfNeeded() {
        guard needsPolling else {
            stopPolling()
            return
        }
        guard pollTask == nil else { return }
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: LibraryModel.pollInterval)
                guard !Task.isCancelled, let self else { return }
                guard self.needsPolling else {
                    self.pollTask = nil
                    return
                }
                await self.pollOnce()
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    /// One silent refresh. Errors are swallowed on purpose — a dropped poll is
    /// not an event the user needs to be told about, the next tick retries.
    private func pollOnce() async {
        guard let resp: DocumentListResponse = try? await api.get("/documents/") else { return }
        let becameReady = resp.documents.contains { new in
            new.status == "ready"
                && documents.first(where: { $0.id == new.id })?.status != "ready"
        }
        documents = resp.documents
        if resp.documents.isEmpty { phase = .empty }
        if becameReady {
            await loadProgress()
            toast = .success("A document finished processing.")
        }
    }

    // MARK: Delete

    /// `DELETE /documents/{id}` answers 204 — `api.delete` tolerates the empty
    /// body. Removal is applied locally rather than by re-listing, so the row
    /// disappears the moment the server confirms.
    func delete(_ doc: Document) async {
        isDeleting = true
        defer { isDeleting = false }
        do {
            try await api.delete("/documents/\(doc.id)")
            documents.removeAll { $0.id == doc.id }
            progressByDocument[doc.id] = nil
            if documents.isEmpty { phase = .empty }
            stopPollingIfSettled()
            toast = .success("Document deleted.")
        } catch {
            toast = .error(Self.message(for: error))
        }
    }

    private func stopPollingIfSettled() {
        if !needsPolling { stopPolling() }
    }

    // MARK: Error mapping

    static func classify(_ error: Error) -> LibraryPhase {
        if let api = error as? APIError, case .network(let m) = api { return .offline(m) }
        return .failed(message(for: error))
    }

    static func message(for error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
