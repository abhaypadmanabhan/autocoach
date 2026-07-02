"""Pydantic models for quiz generation and sessions."""

from typing import Annotated
from enum import Enum

from pydantic import BaseModel, Field, ValidationInfo, field_validator, model_validator


class QuestionType(str, Enum):
    """Canonical question type values. `rendered` is reserved for renderable
    question types (render_kind + render_payload) and is unused for now."""

    TEXT_FREE = "text_free"
    TEXT_MCQ = "text_mcq"
    TEXT_TF = "text_tf"
    RENDERED = "rendered"


DEFAULT_QUESTION_TYPES: list[QuestionType] = [
    QuestionType.TEXT_MCQ,
    QuestionType.TEXT_TF,
    QuestionType.TEXT_FREE,
]


class QuizGenerateRequest(BaseModel):
    """Request model for generating a quiz."""

    document_id: str
    num_questions: int = Field(default=5, ge=1, le=20)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    question_types: list[QuestionType] = Field(default_factory=lambda: list(DEFAULT_QUESTION_TYPES))


class QuestionSchema(BaseModel):
    """Schema for a single quiz question."""

    question_type: QuestionType
    question_text: str
    options: list[str] | None = None
    correct_answer: str
    explanation: str | None = None


OptionText = Annotated[str, Field(min_length=1, max_length=500)]


class LLMQuestion(BaseModel):
    """Validated shape for a single question returned by an LLM."""

    question_type: QuestionType
    question_text: str = Field(min_length=1, max_length=2000)
    options: list[OptionText] | None = None
    correct_answer: str = Field(min_length=1, max_length=2000)
    explanation: str | None = Field(default=None, max_length=2000)
    concept_id: str | None = None

    @field_validator("concept_id")
    @classmethod
    def concept_id_must_be_allowed(
        cls, value: str | None, info: ValidationInfo
    ) -> str | None:
        allowed = set((info.context or {}).get("focus_concept_ids") or [])
        if value and allowed and value not in allowed:
            raise ValueError("concept_id is not in focus_concept_ids")
        return value

    @model_validator(mode="after")
    def validate_type_specific_fields(self) -> "LLMQuestion":
        if self.question_type == QuestionType.TEXT_MCQ:
            if self.options is None or len(self.options) != 4:
                raise ValueError("text_mcq questions must include exactly 4 options")
            normalized_answer = self.correct_answer.strip().upper()
            if len(normalized_answer) > 1 and normalized_answer[1] in {")", ".", " "}:
                normalized_answer = normalized_answer[0]
            if normalized_answer not in {"A", "B", "C", "D"}:
                raise ValueError("text_mcq correct_answer must identify A, B, C, or D")

        if self.question_type == QuestionType.TEXT_TF:
            if self.correct_answer.strip().lower() not in {"true", "false"}:
                raise ValueError("text_tf correct_answer must be true or false")

        return self


class QuizGenerateResponse(BaseModel):
    """Response model for quiz generation."""

    document_id: str
    difficulty: str
    questions: list[QuestionSchema]


# Session models


class QuizSessionCreate(BaseModel):
    """Request model for creating a quiz session."""

    document_id: str | None = None
    mode: str = Field(default="standard", pattern="^(standard|review)$")
    num_questions: int = Field(default=5, ge=1, le=20)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    question_types: list[QuestionType] = Field(default_factory=lambda: list(DEFAULT_QUESTION_TYPES))
    focus_concept_ids: list[str] | None = None


class QuestionResponse(BaseModel):
    """Response model for a question in a session."""

    question_id: str
    question_number: int
    total_questions: int
    question_type: QuestionType
    question_text: str
    options: list[str] | None = None
    difficulty: str


class AnswerSubmit(BaseModel):
    """Request model for submitting an answer."""

    answer: str = Field(min_length=1, max_length=2000)
    input_method: str = Field(default="typed", pattern="^(typed|click|voice)$")


class AnswerResult(BaseModel):
    """Result of evaluating an answer.

    `is_correct` is nullable: for `text_free` the verdict is produced by a
    background LLM eval, so the initial answer response carries `is_correct
    = None` (see `AnswerResponse.eval_status == "pending"`). MCQ / T-F are
    graded inline and always carry a concrete bool.

    `correct_answer` / `explanation` are nullable because pending payloads
    deliberately omit them — the model answer must never be visible before
    the user's answer is graded (answer-leak fix).
    """

    is_correct: bool | None = None
    correct_answer: str | None = None
    explanation: str | None = None
    score_so_far: int
    total_answered: int
    feedback: str | None = None
    xp_awarded: int = 0
    mastery_delta: float = 0.0


class AnswerResponse(BaseModel):
    """Response model for answer submission.

    Note: `next_question` is no longer included. After receiving this
    response, the frontend calls `GET /quiz/sessions/{id}/next` to fetch
    the prepared question (which is generated in the background).

    `eval_status` is `"complete"` when the verdict is final (MCQ / T-F, or a
    `text_free` answer that has finished background grading) and `"pending"`
    when a `text_free` answer is still being evaluated off the request path.
    On `"pending"`, the client polls `GET /quiz/sessions/{id}/answer` for the
    final verdict.
    """

    result: AnswerResult
    session_complete: bool
    session_ended_reason: str | None = None  # "cap_reached" | "mastery_threshold"
    eval_status: str = "complete"  # "complete" | "pending"
    # Set on a pending GET /answer long-poll timeout: suggested client delay
    # before re-polling (mirrors NextQuestionResponse.retry_after_ms).
    retry_after_ms: int | None = None


class NextQuestionResponse(BaseModel):
    """Response model for GET /quiz/sessions/{id}/next."""

    status: str  # "ready" | "preparing" | "ended" | "failed"
    question: QuestionResponse | None = None
    retry_after_ms: int | None = None
    reason: str | None = None
    summary: dict | None = None
    error: str | None = None
    message: str | None = None


class SessionQuestionDetail(BaseModel):
    """Detail of a question in session status."""

    question_id: str
    question_number: int
    question_type: QuestionType
    question_text: str
    user_answer: str | None = None
    is_correct: bool | None = None
    correct_answer: str
    explanation: str | None = None


class SessionStatus(BaseModel):
    """Status of a quiz session."""

    session_id: str
    document_id: str
    status: str
    difficulty: str
    total_questions: int
    answered_questions: int
    correct_answers: int
    score_percentage: float | None = None
    questions: list[SessionQuestionDetail]
    started_at: str
    completed_at: str | None = None
