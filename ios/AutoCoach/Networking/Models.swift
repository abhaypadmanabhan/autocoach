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
    var kind: QuestionKind { QuestionKind(apiValue: question_type) }
}

enum QuestionKind: String, Sendable {
    case mcq = "text_mcq"
    case tf = "text_tf"
    case freeText = "text_free"
    case rendered = "rendered"
    /// A `question_type` this build does not know about.
    ///
    /// Previously the fallback was `.freeText`, which handed the user a text box
    /// for a question the client cannot actually render and silently graded the
    /// answer against the wrong input mode. Unknown must stay unknown so the UI
    /// can refuse it instead of guessing.
    case unknown

    init(apiValue: String) {
        self = QuestionKind(rawValue: apiValue) ?? .unknown
    }
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
    var kind: QuestionKind { QuestionKind(apiValue: question_type) }
}

// MARK: - Free-form JSON

/// Minimal `Any`-free JSON value, for backend fields typed `Dict[str, Any]`.
///
/// `user_onboarding.learning_topics` is a JSONB column the backend neither
/// validates nor flattens beyond a 10 KB cap, so the client cannot model it as a
/// fixed struct without breaking the moment the onboarding flow adds a key.
enum JSONValue: Codable, Sendable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null; return }
        if let v = try? c.decode(Bool.self) { self = .bool(v); return }
        if let v = try? c.decode(Double.self) { self = .number(v); return }
        if let v = try? c.decode(String.self) { self = .string(v); return }
        if let v = try? c.decode([String: JSONValue].self) { self = .object(v); return }
        if let v = try? c.decode([JSONValue].self) { self = .array(v); return }
        throw DecodingError.dataCorruptedError(in: c, debugDescription: "Unsupported JSON value")
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }

    /// Convenience for the common "topics were stored as a string array" shape.
    var stringValue: String? { if case .string(let s) = self { return s }; return nil }
    var arrayValue: [JSONValue]? { if case .array(let a) = self { return a }; return nil }
}

// MARK: - Onboarding  (GET/POST /onboarding)

/// `OnboardingResponse` — backend `app/schemas/onboarding.py`.
///
/// `learning_topics` is `Optional[Dict[str, Any]]`, **not** an array: the backend
/// merges it key-by-key on upsert and stuffs `experience_level` into it as a
/// nested key. Model it as an object or POSTs silently drop data.
struct OnboardingResponse: Codable, Sendable, Equatable {
    let has_completed: Bool
    let learning_topics: [String: JSONValue]?
    let goal: String?
    let study_frequency: String?
    let experience_level: String?
}

/// `OnboardingCreate` — POST body. Every field is optional server-side; the
/// backend merges each against the existing row rather than overwriting.
/// `goal` ≤ 500 chars, `study_frequency` / `experience_level` ≤ 100 chars,
/// `learning_topics` ≤ 10 000 bytes once serialized.
struct OnboardingCreateRequest: Codable, Sendable, Equatable {
    let learning_topics: [String: JSONValue]?
    let goal: String?
    let study_frequency: String?
    let experience_level: String?

    init(
        learning_topics: [String: JSONValue]? = nil,
        goal: String? = nil,
        study_frequency: String? = nil,
        experience_level: String? = nil
    ) {
        self.learning_topics = learning_topics
        self.goal = goal
        self.study_frequency = study_frequency
        self.experience_level = experience_level
    }
}

// MARK: - XP  (POST /xp/redeem)

/// `RedeemXPResponse` — backend `app/api/routes/xp.py`.
///
/// Costs 100 XP and grants exactly one extra quiz credit. Failure modes are
/// non-2xx, not a `success: false` body: 400 insufficient XP, 409 concurrent
/// update, 500 redemption failed (XP refunded).
struct RedeemXPResponse: Codable, Sendable, Equatable {
    let success: Bool
    let message: String
    let new_total_xp: Int
    let credits_added: Int
}

// MARK: - Review  (GET /review/today)

/// `DueConcept` — backend `app/api/routes/review.py`.
/// `mastery_score` is the raw float; `mastery_percent` is the normalized 0…100 int.
struct DueConcept: Codable, Sendable, Equatable, Identifiable {
    let id: String
    let name: String
    let document_id: String
    let mastery_score: Double
    let mastery_percent: Int
}

/// `ReviewTodayResponse`. `limit` is clamped server-side to 1…20.
/// `rules` is a free-form dict — today `{"mastery_below": 0.75, "stale_days": 2}`.
struct ReviewTodayResponse: Codable, Sendable, Equatable {
    let count: Int
    let due_concepts: [DueConcept]
    let rules: [String: JSONValue]
}

// MARK: - Concepts  (GET /documents/{id}/concepts)

/// `ConceptSchema` — backend `app/models/documents.py`.
///
/// Field names are `concept_name` / `concept_description`, **not** `name` /
/// `description`. Mastery fields are zeroed rather than omitted when the user has
/// never been tested on the concept.
struct Concept: Codable, Sendable, Equatable, Identifiable {
    let id: String
    let concept_name: String
    let concept_description: String?
    /// 0…1.
    let importance_score: Double
    let is_core: Bool
    let parent_concept_id: String?
    let created_at: String

    // User mastery — defaulted server-side, so always present.
    let mastery_score: Double
    let times_tested: Int
    let times_correct: Int
    let last_tested_at: String?
    let mastered_at: String?

    var displayName: String { concept_name }
    var hasBeenTested: Bool { times_tested > 0 }
}

struct DocumentConceptsResponse: Codable, Sendable, Equatable {
    let document_id: String
    let concepts: [Concept]
}

// MARK: - Progress  (GET /documents/{id}/progress, GET /documents/progress/summary)

/// `DocumentProgressResponse` — backend `app/models/documents.py`.
///
/// `mastery_percent` is an int 0…100 (already normalized server-side; the backend
/// accepts either a 0…1 ratio or a 0…100 percent from the DB and folds both into
/// percent). `milestone` is `"none" | "25" | "50" | "75" | "100"` — map it with
/// `MilestoneBadge.Level(apiValue:)`.
struct DocumentProgress: Codable, Sendable, Equatable, Identifiable {
    let document_id: String
    let document_title: String?
    let mastery_percent: Int
    let concepts_total: Int
    let concepts_practiced: Int
    let weak_concepts_count: Int
    let mastered_concepts_count: Int
    let milestone: String

    var id: String { document_id }
}

struct DocumentProgressSummaryResponse: Codable, Sendable, Equatable {
    let documents: [DocumentProgress]
}
