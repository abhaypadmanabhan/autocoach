"""Pydantic models for quiz generation."""

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
