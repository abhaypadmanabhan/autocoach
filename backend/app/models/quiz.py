"""Pydantic models for quiz generation and sessions."""

from pydantic import BaseModel, Field


class QuizGenerateRequest(BaseModel):
    """Request model for generating a quiz."""

    document_id: str
    num_questions: int = Field(default=5, ge=1, le=20)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    question_types: list[str] = Field(default=["mcq", "true_false", "free_text"])


class QuestionSchema(BaseModel):
    """Schema for a single quiz question."""

    question_type: str
    question_text: str
    options: list[str] | None = None
    correct_answer: str
    explanation: str | None = None


class QuizGenerateResponse(BaseModel):
    """Response model for quiz generation."""

    document_id: str
    difficulty: str
    questions: list[QuestionSchema]


# Session models

class QuizSessionCreate(BaseModel):
    """Request model for creating a quiz session."""

    document_id: str
    num_questions: int = Field(default=5, ge=1, le=20)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    question_types: list[str] = Field(default=["mcq", "true_false", "free_text"])


class QuestionResponse(BaseModel):
    """Response model for a question in a session."""

    question_id: str
    question_number: int
    total_questions: int
    question_type: str
    question_text: str
    options: list[str] | None = None
    difficulty: str


class AnswerSubmit(BaseModel):
    """Request model for submitting an answer."""

    answer: str
    input_method: str = Field(default="typed", pattern="^(typed|voice)$")


class AnswerResult(BaseModel):
    """Result of evaluating an answer."""

    is_correct: bool
    correct_answer: str
    explanation: str | None = None
    score_so_far: int
    total_answered: int
    feedback: str | None = None


class AnswerResponse(BaseModel):
    """Response model for answer submission."""

    result: AnswerResult
    next_question: QuestionResponse | None = None
    session_complete: bool


class SessionQuestionDetail(BaseModel):
    """Detail of a question in session status."""

    question_id: str
    question_number: int
    question_type: str
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
