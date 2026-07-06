import Foundation

// MARK: - Documents

struct DocumentListResponse: Codable, Sendable {
    let documents: [Document]
}

/// `GET /documents/` item. `id` / `created_at` arrive as JSON strings (UUID /
/// ISO-8601); we keep them as `String` to avoid date-format fragility.
struct Document: Codable, Sendable, Identifiable {
    let id: String
    let filename: String
    let file_type: String
    let file_size: Int
    let status: String            // "pending" | "processing" | "ready" | "failed"
    let ai_title: String?
    let session_id: String?
    let concept_count: Int?
    let created_at: String

    var id_uuid: String { id }
    var displayTitle: String { ai_title?.isEmpty == false ? ai_title! : filename }
}

// MARK: - Quiz sessions

/// `POST /quiz/sessions/` body (standard mode, default config).
struct SessionCreateRequest: Codable, Sendable {
    let document_id: String
    let mode: String
    let num_questions: Int
    let difficulty: String
    let question_types: [String]
    let focus_concept_ids: [String]?

    static func standard(documentId: String) -> SessionCreateRequest {
        SessionCreateRequest(
            document_id: documentId,
            mode: "standard",
            num_questions: 5,
            difficulty: "medium",
            question_types: ["text_mcq", "text_tf", "text_free"],
            focus_concept_ids: nil
        )
    }
}

/// `POST /quiz/sessions/` response.
struct SessionCreateResponse: Codable, Sendable {
    let session_id: String
    let document_id: String
    let difficulty: String
    let total_questions: Int
    let first_question: Question
}

/// `QuestionResponse` — shared shape for the first question, current, and next.
struct Question: Codable, Sendable, Identifiable, Equatable {
    let question_id: String
    let question_number: Int
    let total_questions: Int
    let question_type: String     // "text_mcq" | "text_tf" | "text_free" | "rendered"
    let question_text: String
    let options: [String]?
    let difficulty: String

    var id: String { question_id }
    var kind: QuestionKind { QuestionKind(rawValue: question_type) ?? .freeText }
}

enum QuestionKind: String, Sendable {
    case mcq = "text_mcq"
    case tf = "text_tf"
    case freeText = "text_free"
    case rendered = "rendered"
}

/// `POST /quiz/sessions/{id}/answer?question_id=…` body.
struct AnswerSubmit: Codable, Sendable {
    let answer: String
    let input_method: String      // "typed" | "click" | "voice"
}

enum InputMethod: String, Sendable {
    case typed, click, voice
}

/// `AnswerResponse.result`.
struct AnswerResult: Codable, Sendable, Equatable {
    /// Tri-state: `nil` while `eval_status == "pending"` (text_free still grading).
    let is_correct: Bool?
    let correct_answer: String?
    let explanation: String?
    let score_so_far: Int
    let total_answered: Int
    let feedback: String?
    let xp_awarded: Int?
    let mastery_delta: Double?
}

/// `POST /answer` and `GET /answer` (verdict long-poll) response.
struct AnswerResponse: Codable, Sendable, Equatable {
    let result: AnswerResult
    let session_complete: Bool
    let session_ended_reason: String?     // "cap_reached" | "mastery_threshold"
    let eval_status: String               // "complete" | "pending"
    let retry_after_ms: Int?
}

/// `GET /quiz/sessions/{id}/next?wait_ms=…` response.
struct NextQuestionResponse: Codable, Sendable {
    let status: String            // "ready" | "preparing" | "ended" | "failed"
    let question: Question?
    let retry_after_ms: Int?
    let reason: String?
    let summary: SessionSummary?
    let error: String?
    let message: String?
}

struct SessionSummary: Codable, Sendable, Equatable {
    let total_answered: Int
    let correct_answers: Int
    let score_percentage: Double?
}

/// `GET /quiz/sessions/{id}` — the results payload.
struct SessionStatus: Codable, Sendable {
    let session_id: String
    let document_id: String
    let status: String
    let difficulty: String
    let total_questions: Int
    let answered_questions: Int
    let correct_answers: Int
    let score_percentage: Double?
    let questions: [SessionQuestionDetail]
    let started_at: String
    let completed_at: String?
}

struct SessionQuestionDetail: Codable, Sendable, Identifiable {
    let question_id: String
    let question_number: Int
    let question_type: String
    let question_text: String
    let user_answer: String?
    /// Tri-state: `nil` if the answer was never graded (still pending / errored).
    let is_correct: Bool?
    let correct_answer: String
    let explanation: String?
    var id: String { question_id }
    var kind: QuestionKind { QuestionKind(rawValue: question_type) ?? .freeText }
}
