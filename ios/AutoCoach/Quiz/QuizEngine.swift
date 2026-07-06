import Foundation

/// Per-session state machine (research §4). Owns the answer → verdict → next
/// polling choreography so views only render phases.
///
/// `@MainActor` + `@Observable`: mutations happen on the main actor; polling
/// `Task`s inherit MainActor isolation, so `await`ing the `APIClient` actor
/// suspends without blocking the UI and state stays coherent.
///
/// Invariants (from `frontend/src/hooks/useQuiz.ts` + §4):
/// - **Never resubmit.** Once `submitAnswer` succeeds (even `pending`), the
///   answer is persisted — only `GET /answer` is polled for the verdict.
/// - **Never throw out of the verdict loop.** Transient poll errors are
///   swallowed and counted as a failed attempt.
/// - **`is_correct` is tri-state.** Stays `nil` while `eval_status ==
///   "pending"` and on window exhaustion → UI shows "still grading".
/// - Verdict poll: `wait_ms=5000`, `maxAttempts=6`. Next poll: `wait_ms=5000`,
///   `maxAttempts=4` + one final `wait_ms=2000`.
@MainActor
@Observable
final class QuizEngine {
    enum Phase: Equatable, Sendable {
        case answering
        case submitting
        case grading(attempt: Int)
        case gradingTimedOut      // window exhausted, still pending
        case verdict              // verdict landed for the current question
        case awaitingNext(attempt: Int)
        case finished             // → ResultsView fetches full SessionStatus
        case failed(String)
    }

    private(set) var phase: Phase = .answering
    private(set) var currentQuestion: Question?
    private(set) var lastResult: AnswerResult?     // is_correct: Bool? tri-state
    private(set) var sessionComplete: Bool = false
    private(set) var sessionEndedReason: String?
    private(set) var lastInputMethod: InputMethod = .typed
    private(set) var scoreSoFar: Int = 0
    private(set) var totalAnswered: Int = 0
    private(set) var totalQuestions: Int = 0
    private(set) var sessionId: String
    private(set) var documentId: String
    private(set) var verdictSettled: Bool = false
    private(set) var error: String?

    private let api: APIClient
    // `nonisolated(unsafe)`: cancelled from `deinit` (nonisolated context).
    nonisolated(unsafe) private var pollTask: Task<Void, Never>?

    /// Created *after* `POST /quiz/sessions/` succeeds (DashboardView does the
    /// create), so it starts in `.answering` with the first question.
    init(api: APIClient, created: SessionCreateResponse) {
        self.api = api
        self.sessionId = created.session_id
        self.documentId = created.document_id
        self.totalQuestions = created.total_questions
        self.currentQuestion = created.first_question
        self.phase = .answering
    }

    deinit { pollTask?.cancel() }

    // MARK: - Submit (MCQ / TF / free-text)

    /// Submit an answer. MCQ → letter ("A"…"D"); TF → "true"/"false"; free-text
    /// → the typed/dictated string. `inputMethod` is sent as-is (voice → "voice").
    func submitAnswer(_ answer: String, inputMethod: InputMethod) async {
        guard phase == .answering, let question = currentQuestion, !answer.isEmpty else { return }
        cancelPoll()
        lastInputMethod = inputMethod
        phase = .submitting
        verdictSettled = false
        lastResult = nil
        error = nil

        let body = AnswerSubmit(answer: answer, input_method: inputMethod.rawValue)
        let query = [URLQueryItem(name: "question_id", value: question.question_id)]

        let response: AnswerResponse
        do {
            response = try await api.post("/quiz/sessions/\(sessionId)/answer", body: body, query: query)
        } catch {
            // Threw before persisting → safe to resubmit; stay on the question.
            phase = .answering
            self.error = message(for: error)
            return
        }

        recordProgress(from: response.result)
        sessionComplete = response.session_complete
        sessionEndedReason = response.session_ended_reason

        if response.eval_status == "pending" {
            phase = .grading(attempt: 0)
            pollTask = Task { [weak self] in await self?.runVerdictPoll(questionId: question.question_id) }
        } else {
            lastResult = response.result
            verdictSettled = true
            phase = .verdict
        }
    }

    /// Manual re-check after the grading window exhausted.
    func recheckVerdict() async {
        guard phase == .gradingTimedOut, let question = currentQuestion else { return }
        cancelPoll()
        phase = .grading(attempt: 0)
        pollTask = Task { [weak self] in await self?.runVerdictPoll(questionId: question.question_id) }
    }

    // MARK: - Advance (GET /next)

    func advanceToNext() async {
        guard phase == .verdict else { return }
        if sessionComplete { phase = .finished; return }
        cancelPoll()
        phase = .awaitingNext(attempt: 0)
        pollTask = Task { [weak self] in await self?.runNextPoll() }
    }

    /// Retry after a `failed` state (e.g. next-question generation timed out).
    func retryAdvance() async {
        guard case .failed = phase else { return }
        cancelPoll()
        error = nil
        phase = .awaitingNext(attempt: 0)
        pollTask = Task { [weak self] in await self?.runNextPoll() }
    }

    func cancel() { cancelPoll() }

    // MARK: - Verdict poll loop (text_free)

    private func runVerdictPoll(questionId: String) async {
        let maxAttempts = 6
        var attempt = 0

        while attempt < maxAttempts {
            if Task.isCancelled { return }
            attempt += 1
            phase = .grading(attempt: attempt)

            let query = [
                URLQueryItem(name: "question_id", value: questionId),
                URLQueryItem(name: "wait_ms", value: "5000")
            ]
            do {
                let verdict: AnswerResponse = try await api.get("/quiz/sessions/\(sessionId)/answer", query: query)
                if verdict.eval_status != "pending" {
                    applyVerdict(verdict)
                    return
                }
                let delay = verdict.retry_after_ms ?? 300
                await sleep(ms: max(delay, 200))
            } catch {
                // Transient poll error — swallow, back off, keep polling.
                // Never throw, never resubmit.
                await sleep(ms: 1000)
            }
        }

        // Window exhausted while still pending → "still grading" (NOT a verdict).
        phase = .gradingTimedOut
    }

    // MARK: - Next-question poll loop

    private func runNextPoll() async {
        let maxAttempts = 4
        var attempt = 0

        while attempt < maxAttempts {
            if Task.isCancelled { return }
            attempt += 1
            phase = .awaitingNext(attempt: attempt)

            do {
                let next: NextQuestionResponse = try await api.get(
                    "/quiz/sessions/\(sessionId)/next",
                    query: [URLQueryItem(name: "wait_ms", value: "5000")]
                )
                switch next.status {
                case "ready":
                    if let q = next.question {
                        currentQuestion = q; lastResult = nil; verdictSettled = false
                        sessionComplete = false; phase = .answering
                    } else {
                        phase = .failed("No question returned.")
                    }
                    return
                case "ended":
                    sessionEndedReason = next.reason; sessionComplete = true; phase = .finished
                    return
                case "preparing":
                    let delay = next.retry_after_ms ?? 500
                    await sleep(ms: max(delay, 300))
                case "failed":
                    phase = .failed(next.message ?? next.error ?? "Question generation failed.")
                    return
                default:
                    phase = .failed("Unexpected response from server.")
                    return
                }
            } catch {
                await sleep(ms: 1000)
            }
        }

        // Final short attempt before surfacing a timeout.
        do {
            let next: NextQuestionResponse = try await api.get(
                "/quiz/sessions/\(sessionId)/next",
                query: [URLQueryItem(name: "wait_ms", value: "2000")]
            )
            switch next.status {
            case "ready":
                if let q = next.question {
                    currentQuestion = q; lastResult = nil; verdictSettled = false; phase = .answering
                } else { phase = .failed("No question returned.") }
            case "ended":
                sessionEndedReason = next.reason; sessionComplete = true; phase = .finished
            case "preparing", "failed", _:
                phase = .failed("Question generation took too long. Please retry.")
            }
        } catch {
            phase = .failed("Question generation took too long. Please retry.")
        }
    }

    // MARK: - Helpers

    private func applyVerdict(_ response: AnswerResponse) {
        lastResult = response.result
        verdictSettled = true
        recordProgress(from: response.result)
        sessionComplete = response.session_complete
        sessionEndedReason = response.session_ended_reason
        phase = .verdict
    }

    private func recordProgress(from result: AnswerResult) {
        scoreSoFar = result.score_so_far
        totalAnswered = result.total_answered
    }

    private func cancelPoll() {
        pollTask?.cancel()
        pollTask = nil
    }

    private func sleep(ms: Int) async {
        let nanos = UInt64(max(ms, 0)) * 1_000_000
        try? await Task.sleep(nanoseconds: nanos)
    }

    private func message(for error: Error) -> String {
        if let apiError = error as? APIError { return apiError.errorDescription ?? "Something went wrong." }
        return error.localizedDescription
    }
}