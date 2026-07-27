import Foundation

/// Session defaults.
///
/// A nonisolated enum rather than statics on ``TodayModel``, which is
/// `@MainActor`: a main-actor-isolated static cannot be a default argument in a
/// nonisolated initialiser under Swift 6 strict concurrency.
enum TodayDefaults {
    static let questionTypes = ["text_mcq", "text_tf", "text_free"]
}

/// `POST /quiz/sessions/` body for a **review** session.
///
/// A local type rather than `SessionCreateRequest` because that struct types
/// `document_id` as non-optional, and review mode must send no document at all —
/// the backend picks the most-due document itself (`pick_review_document`). An
/// optional property encodes via `encodeIfPresent`, so `nil` omits the key
/// entirely rather than sending `null`.
///
/// `num_questions` is deliberately absent too: for review the server derives it
/// from the number of due concepts and ignores whatever the client asks for.
///
/// `Encodable` only, and every property assigned in `init` rather than given an
/// inline default — a `let` with an initial value is silently dropped from
/// synthesized `CodingKeys`, which would have shipped a body with no `mode` at
/// all: a standard session billed against the quota, wearing a review label.
struct ReviewSessionCreateRequest: Encodable, Sendable {
    let mode: String
    let difficulty: String
    let question_types: [String]
    let document_id: String?

    init(difficulty: String = "medium", questionTypes: [String] = TodayDefaults.questionTypes) {
        self.mode = "review"
        self.difficulty = difficulty
        self.question_types = questionTypes
        self.document_id = nil
    }
}
