import Foundation
import Observation

/// An unfinished session the user can drop straight back into.
struct ResumableSession: Equatable, Sendable, Identifiable {
    let sessionId: String
    let documentId: String
    let title: String
    let answered: Int
    let total: Int
    let difficulty: String
    let startedAt: String

    var id: String { sessionId }
}

/// Last-known Today payload, cached to the App Group container so the offline
/// state can show real numbers with an honest timestamp instead of a blank page.
struct TodaySnapshot: Codable, Equatable, Sendable {
    var dueCount: Int
    var dueConcepts: [DueConcept]
    var documentCount: Int
    var savedAt: Date
}

/// Loader + actions for ``TodayView``.
///
/// Owns nothing the backend owns. Every number on screen is either a live read
/// of an existing endpoint or an explicitly-labelled device-local value
/// (streak, credits).
@MainActor
@Observable
final class TodayModel {
    enum Phase: Equatable {
        case loading
        case ready
        /// A real failure with a message worth showing.
        case failed(String)
        /// No usable network path. Rendered from the cached snapshot when there
        /// is one, as a designed screen when there is not.
        case offline
    }

    enum Starting: Equatable {
        case review
        case resume
        case concept(String)
    }

    static let snapshotFileName = "today-snapshot.json"

    private(set) var phase: Phase = .loading
    private(set) var due: ReviewTodayResponse?
    private(set) var documents: [Document] = []
    /// `GET /documents/` is a secondary read and is allowed to fail without
    /// failing the screen — but an empty `documents` then means "we don't know",
    /// not "the account has none". Without this flag a dropped documents call
    /// renders the no-documents empty state on top of a live due queue.
    private(set) var documentsLoaded = false
    private(set) var progress: [DocumentProgress] = []
    private(set) var resumable: ResumableSession?
    private(set) var snapshot: TodaySnapshot?
    private(set) var starting: Starting?

    /// Set when the server answers the daily-quota 429. Frames the quota as
    /// anticipation (design PRD principle 3) — never as an alert.
    private(set) var quotaBlocked = false

    var toast: ACXToast?

    // Presentation of the quiz cover.
    private(set) var presentedEngine: QuizEngine?
    private(set) var presentedTitle = ""
    var showQuiz = false

    let streak: StreakStore
    let credits: CreditsStore
    let reachability: NetworkReachability

    /// Internal so the view can hand the same client to `QuizSessionView`.
    let api: APIClient
    private let store: AppGroupStore

    init(
        api: APIClient,
        streak: StreakStore = StreakStore(),
        credits: CreditsStore = CreditsStore(),
        reachability: NetworkReachability = NetworkReachability(),
        store: AppGroupStore = .shared
    ) {
        self.api = api
        self.streak = streak
        self.credits = credits
        self.reachability = reachability
        self.store = store
        self.snapshot = store.read(TodaySnapshot.self, from: Self.snapshotFileName)
    }

    // MARK: - Derived

    var dueCount: Int { due?.count ?? snapshot?.dueCount ?? 0 }

    /// The three weakest due concepts, lowest mastery first. Sorted here rather
    /// than trusting the endpoint's order, which is not part of its contract.
    var weakestConcepts: [DueConcept] {
        let source = due?.due_concepts ?? snapshot?.dueConcepts ?? []
        return Array(source.sorted { $0.mastery_percent < $1.mastery_percent }.prefix(3))
    }

    /// True when the account has no documents at all — a different screen from
    /// "nothing is due", and the only genuinely *empty* state here.
    var hasNoDocuments: Bool {
        guard phase == .ready, documentsLoaded else { return false }
        return documents.isEmpty && dueCount == 0
    }

    var aggregateMasteryPercent: Int? {
        guard !progress.isEmpty else { return nil }
        return progress.map(\.mastery_percent).reduce(0, +) / progress.count
    }

    // MARK: - Load

    func load() async {
        reachability.start()
        credits.rollOverIfNeeded()

        if due == nil { phase = .loading }

        guard reachability.isOnline else {
            phase = .offline
            return
        }

        async let dueTask = Self.fetchDue(api)
        async let documentsTask = Self.fetchDocuments(api)
        async let progressTask = Self.fetchProgress(api)
        let (dueResult, documentList, progressList) = await (dueTask, documentsTask, progressTask)

        switch dueResult {
        case .success(let payload):
            due = payload
            if let documentList {
                documents = documentList
                documentsLoaded = true
            }
            progress = progressList ?? progress
            phase = .ready
            cacheSnapshot(payload)
            resumable = await Self.probeResumable(api, documents: documents)
        case .failure(let error):
            // Only a genuine transport failure earns the offline screen. Every
            // other error keeps its own message, so "offline" never becomes a
            // catch-all excuse for a 500.
            if case .network = error {
                phase = .offline
            } else {
                phase = .failed(error.errorDescription ?? "Couldn't load today.")
            }
        }
    }

    private func cacheSnapshot(_ payload: ReviewTodayResponse) {
        let snap = TodaySnapshot(
            dueCount: payload.count,
            dueConcepts: Array(payload.due_concepts.prefix(3)),
            documentCount: documents.count,
            savedAt: Date()
        )
        snapshot = snap
        store.write(snap, to: Self.snapshotFileName)
    }

    // MARK: - Actions

    /// Start the free, quota-exempt review session.
    ///
    /// `mode: "review"` skips `consume_quiz_usage_or_429` server-side, so this
    /// path must never touch ``CreditsStore``.
    func startReview() async {
        guard starting == nil else { return }
        starting = .review
        defer { starting = nil }

        do {
            let created: SessionCreateResponse = try await api.post(
                "/quiz/sessions/",
                body: ReviewSessionCreateRequest()
            )
            let title = documents.first { $0.id == created.document_id }?.displayTitle ?? "Review"
            begin(created, title: title)
        } catch let error as APIError {
            if case .http(let status, _) = error, status == 404 {
                // The queue drained since we loaded it. Resync instead of
                // showing the user an error for a good outcome.
                toast = .info("Nothing is due right now — you're ahead.")
                await load()
            } else {
                report(error)
            }
        } catch {
            toast = .error(error.localizedDescription)
        }
    }

    /// Start a standard session focused on one weak concept. This one **does**
    /// spend a credit.
    func startFocused(on concept: DueConcept) async {
        guard starting == nil else { return }
        starting = .concept(concept.id)
        defer { starting = nil }

        let body = SessionCreateRequest(
            document_id: concept.document_id,
            mode: "standard",
            num_questions: 5,
            difficulty: "medium",
            question_types: TodayDefaults.questionTypes,
            focus_concept_ids: [concept.id]
        )

        do {
            let created: SessionCreateResponse = try await api.post("/quiz/sessions/", body: body)
            credits.noteStandardSessionStarted()
            quotaBlocked = false
            let title = documents.first { $0.id == created.document_id }?.displayTitle ?? concept.name
            begin(created, title: title)
        } catch let error as APIError {
            report(error)
        } catch {
            toast = .error(error.localizedDescription)
        }
    }

    /// Resume the unfinished session behind the continue card.
    func resume() async {
        guard starting == nil, let session = resumable else { return }
        starting = .resume
        defer { starting = nil }

        do {
            let question: Question = try await api.get("/quiz/sessions/\(session.sessionId)/current")
            // `QuizEngine` is initialised from a create-response; a resume has the
            // same shape once the current question stands in for the first one.
            let created = SessionCreateResponse(
                session_id: session.sessionId,
                document_id: session.documentId,
                difficulty: session.difficulty,
                total_questions: question.total_questions,
                first_question: question
            )
            begin(created, title: session.title)
        } catch let error as APIError {
            // 410 (not active) / 404 (finished elsewhere) mean the card is stale,
            // not that anything went wrong.
            if case .http(let status, _) = error, status == 410 || status == 404 {
                resumable = nil
                toast = .info("That session already finished.")
                await load()
            } else {
                report(error)
            }
        } catch {
            toast = .error(error.localizedDescription)
        }
    }

    private func begin(_ created: SessionCreateResponse, title: String) {
        streak.recordStudy()
        presentedTitle = title
        presentedEngine = QuizEngine(api: api, created: created)
        showQuiz = true
    }

    func quizDismissed() {
        presentedEngine = nil
        showQuiz = false
    }

    private func report(_ error: APIError) {
        if case .dailyQuota(let limit, _) = error {
            // The one authoritative reading of the quota we ever get.
            credits.noteDailyQuotaReached(limit: limit)
            quotaBlocked = true
            return
        }
        toast = .error(error.errorDescription ?? "Something went wrong.")
    }

    // MARK: - Fetch helpers
    //
    // `nonisolated static` so the three reads can run as concurrent `async let`
    // without any of them hopping back to the main actor to touch `self`.

    private nonisolated static func fetchDue(_ api: APIClient) async -> Result<ReviewTodayResponse, APIError> {
        do {
            let response: ReviewTodayResponse = try await api.get(
                "/review/today",
                query: [URLQueryItem(name: "limit", value: "20")]
            )
            return .success(response)
        } catch let error as APIError {
            return .failure(error)
        } catch {
            return .failure(.network(error.localizedDescription))
        }
    }

    private nonisolated static func fetchDocuments(_ api: APIClient) async -> [Document]? {
        let response: DocumentListResponse? = try? await api.get("/documents/")
        return response?.documents
    }

    private nonisolated static func fetchProgress(_ api: APIClient) async -> [DocumentProgress]? {
        let response: DocumentProgressSummaryResponse? = try? await api.get("/documents/progress/summary")
        return response?.documents
    }

    /// Finds an unfinished session.
    ///
    /// `GET /documents/` carries only the *latest* session id per document and no
    /// status, so the in-progress one has to be found by probing. Bounded to the
    /// four newest documents: the per-minute quiz limiter allows 60, and an
    /// unbounded fan-out over a large library would spend that on a secondary
    /// card. A session on an older document is missed — an honest limit of the
    /// frozen API, not a bug to hunt.
    private nonisolated static func probeResumable(
        _ api: APIClient,
        documents: [Document]
    ) async -> ResumableSession? {
        let candidates = documents
            .compactMap { doc -> (id: String, title: String)? in
                guard let sessionId = doc.session_id else { return nil }
                return (sessionId, doc.displayTitle)
            }
            .prefix(4)
        guard !candidates.isEmpty else { return nil }

        return await withTaskGroup(of: ResumableSession?.self) { group in
            for candidate in candidates {
                group.addTask {
                    guard let status: SessionStatus = try? await api.get("/quiz/sessions/\(candidate.id)")
                    else { return nil }
                    guard status.status == "active",
                          status.answered_questions < status.total_questions
                    else { return nil }
                    return ResumableSession(
                        sessionId: status.session_id,
                        documentId: status.document_id,
                        title: candidate.title,
                        answered: status.answered_questions,
                        total: status.total_questions,
                        difficulty: status.difficulty,
                        startedAt: status.started_at
                    )
                }
            }
            var newest: ResumableSession?
            for await found in group {
                guard let found else { continue }
                // ISO-8601 timestamps sort correctly as strings.
                if newest == nil || found.startedAt > newest!.startedAt { newest = found }
            }
            return newest
        }
    }
}
