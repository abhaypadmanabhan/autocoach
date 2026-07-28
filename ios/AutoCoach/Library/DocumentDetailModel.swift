import Foundation

/// What `DocumentDetailView` hands to the (Phase 3) session config sheet.
///
/// Exposed now so the sheet can be dropped in without reshaping this screen:
/// the focus selection is the part the sheet cannot re-derive on its own.
struct SessionConfigRequest: Hashable, Sendable {
    let documentID: String
    let documentTitle: String
    let focusConceptIDs: [String]
}

enum DetailPhase: Equatable, Sendable {
    case loading
    case loaded
    /// Document is `pending` / `processing` — nothing to show yet, and polling.
    case processing
    /// Ingestion produced no concepts. A designed screen, not an error toast.
    case noConcepts
    case offline(String)
    case failed(String)
}

/// Document detail state (PRD §5.8) — the mastery surface.
@MainActor
@Observable
final class DocumentDetailModel {
    /// Backend cap on `focus_concept_ids` (`sessions.py` rejects a 4th with 400).
    static let maxFocusConcepts = 3
    private static let pollInterval: Duration = .seconds(2)

    private(set) var phase: DetailPhase = .loading
    private(set) var document: Document?
    private(set) var concepts: [Concept] = []
    private(set) var progress: DocumentProgress?
    private(set) var isStarting = false
    private(set) var quotaLimit: Int?
    private(set) var selection: [String] = []
    var toast: ACXToast?

    let documentID: String
    let fallbackTitle: String
    private let api: APIClient
    /// `@ObservationIgnored` (a `Task` handle is not view state) + `nonisolated(unsafe)`,
    /// because `deinit` cancels it from a nonisolated context.
    @ObservationIgnored nonisolated(unsafe) private var pollTask: Task<Void, Never>?

    init(documentID: String, fallbackTitle: String, api: APIClient) {
        self.documentID = documentID
        self.fallbackTitle = fallbackTitle
        self.api = api
        self.quotaLimit = LibraryDefaults.isQuotaExhaustedToday
            ? UserDefaults.standard.integer(forKey: LibraryDefaults.quotaLimit)
            : nil
        #if DEBUG
        if LibrarySample.isActive { seedFromSample() }
        #endif
    }

    deinit { pollTask?.cancel() }

    #if DEBUG
    /// See ``LibrarySample`` — fixed data so this screen is reviewable without a
    /// session or token spend. `load` is a no-op while seeded.
    private(set) var isSeeded = false

    private func seedFromSample() {
        document = LibrarySample.detailDocument
        concepts = LibrarySample.concepts
        progress = LibrarySample.detailProgress
        phase = .loaded
        isSeeded = true
    }
    #endif

    // MARK: Derived

    var title: String { document?.displayTitle ?? fallbackTitle }
    var isReady: Bool { document?.status == "ready" }
    var quotaExhausted: Bool { quotaLimit != nil }

    /// **Weakest first**, which is the useful order — alphabetical would bury
    /// exactly the concepts the user opened this screen to find. Ties break on
    /// importance (descending) so a weak core concept outranks a weak footnote,
    /// then on name so the order is stable across reloads.
    var sortedConcepts: [Concept] {
        concepts.sorted { a, b in
            if a.mastery_score != b.mastery_score { return a.mastery_score < b.mastery_score }
            if a.importance_score != b.importance_score { return a.importance_score > b.importance_score }
            return a.concept_name.localizedCaseInsensitiveCompare(b.concept_name) == .orderedAscending
        }
    }

    var configRequest: SessionConfigRequest {
        SessionConfigRequest(documentID: documentID, documentTitle: title, focusConceptIDs: selection)
    }

    func isSelected(_ concept: Concept) -> Bool { selection.contains(concept.id) }

    /// Toggling a 4th concept is refused **with an explanation** rather than
    /// silently ignored or silently evicting the oldest pick.
    func toggle(_ concept: Concept) {
        if let index = selection.firstIndex(of: concept.id) {
            selection.remove(at: index)
            return
        }
        guard selection.count < Self.maxFocusConcepts else {
            toast = .info("You can focus up to \(Self.maxFocusConcepts) concepts. Deselect one first.")
            return
        }
        selection.append(concept.id)
    }

    // MARK: Loading

    func load(initial: Bool = false) async {
        #if DEBUG
        if isSeeded { return }
        #endif
        if initial { phase = .loading }
        do {
            let doc: Document = try await api.get("/documents/\(documentID)")
            document = doc
            if doc.status == "pending" || doc.status == "processing" {
                phase = .processing
                startPollingIfNeeded()
                return
            }
            if doc.status == "failed" {
                phase = .failed("This document didn't finish processing, so there are no concepts to study.")
                return
            }
        } catch {
            phase = LibraryModel.classify(error).asDetailPhase
            return
        }

        stopPolling()
        await loadConceptsAndProgress()
    }

    private func loadConceptsAndProgress() async {
        do {
            let resp: DocumentConceptsResponse = try await api.get("/documents/\(documentID)/concepts")
            concepts = resp.concepts
            phase = resp.concepts.isEmpty ? .noConcepts : .loaded
        } catch {
            phase = LibraryModel.classify(error).asDetailPhase
            return
        }
        // Progress is a second, independent request: losing it costs the mastery
        // block, not the concept table, so it degrades instead of failing.
        if let p: DocumentProgress = try? await api.get("/documents/\(documentID)/progress") {
            progress = p
        }
    }

    // MARK: Polling

    private func startPollingIfNeeded() {
        guard pollTask == nil else { return }
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: DocumentDetailModel.pollInterval)
                guard !Task.isCancelled, let self else { return }
                guard self.phase == .processing else {
                    self.pollTask = nil
                    return
                }
                await self.load()
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    // MARK: Start a session

    /// `POST /quiz/sessions/` with the current focus selection.
    ///
    /// The daily-quota 429 carries an **object** `detail` and the server has
    /// already deleted the session it just created, so this returns `nil` and
    /// flips the screen into the credits state — never an alert, never a retry.
    func startSession() async -> SessionCreateResponse? {
        guard isReady else { return nil }
        isStarting = true
        defer { isStarting = false }
        let body = SessionCreateRequest(
            document_id: documentID,
            mode: "standard",
            num_questions: 5,
            difficulty: "medium",
            question_types: ["text_mcq", "text_tf", "text_free"],
            focus_concept_ids: selection.isEmpty ? nil : selection
        )
        do {
            let resp: SessionCreateResponse = try await api.post("/quiz/sessions/", body: body)
            return resp
        } catch APIError.dailyQuota(let limit, _) {
            quotaLimit = limit
            LibraryDefaults.recordQuotaExhausted(limit: limit)
            return nil
        } catch {
            toast = .error(LibraryModel.message(for: error))
            return nil
        }
    }

    /// Refreshes mastery after a session so the table reflects what just happened.
    func reloadAfterSession() async {
        await loadConceptsAndProgress()
    }
}

private extension LibraryPhase {
    /// Reuses the Library's transport-vs-server classification without giving
    /// the two screens a shared phase type they would otherwise diverge on.
    var asDetailPhase: DetailPhase {
        switch self {
        case .offline(let m): .offline(m)
        case .failed(let m): .failed(m)
        case .loading, .loaded, .empty: .failed("Something went wrong.")
        }
    }
}
