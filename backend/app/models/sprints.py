"""Pydantic models for daily sprint endpoints."""

from pydantic import BaseModel, Field

from app.models.quiz import AnswerResult, QuestionResponse


class SprintSchema(BaseModel):
    id: str
    user_id: str
    sprint_date: str
    document_id: str | None = None
    target_concepts: list[str] | None = None
    num_questions: int
    completed_questions: int
    xp_earned: int
    status: str
    created_at: str | None = None
    updated_at: str | None = None


class UserStatsSchema(BaseModel):
    user_id: str
    xp_total: int
    streak_current: int
    streak_best: int
    last_active_date: str | None = None
    updated_at: str | None = None


class SprintTodayResponse(BaseModel):
    sprint: SprintSchema
    questions: list[QuestionResponse]
    user_stats: UserStatsSchema


class SprintAnswerSubmit(BaseModel):
    sprint_id: str
    question_id: str
    answer: str
    input_method: str = Field(default="typed", pattern="^(typed|click|voice)$")


class SprintAnswerResponse(BaseModel):
    sprint: SprintSchema
    result: AnswerResult
    user_stats: UserStatsSchema
