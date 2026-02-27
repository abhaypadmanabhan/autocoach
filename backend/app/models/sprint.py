from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional


class SprintStatusResponse(BaseModel):
    status: str  # "ready", "active", "completed"
    streak_count: int
    total_xp: int
    last_sprint_date: Optional[date]
    next_sprint_available_at: Optional[datetime]
    completed_today: Optional[bool] = None
    questions: Optional[list[dict]] = None
    # Active session details
    session_id: Optional[str] = None
    document_title: Optional[str] = None
    next_question_number: Optional[int] = None
    progress: Optional[dict] = None  # { "current": int, "total": int }


class StartSprintRequest(BaseModel):
    pass


class StartSprintResponse(BaseModel):
    session_id: str
    document_id: str
    document_title: str
    questions: list[dict]  # Full quiz object or list of questions


class SprintAnswerRequest(BaseModel):
    session_id: str
    question_id: str
    answer: str


class SprintAnswerResponse(BaseModel):
    correct: bool
    explanation: Optional[str] = None
    feedback: Optional[str] = None
    correct_answer: Optional[str] = None
    next_question_id: Optional[str] = None
    next_question_number: Optional[int] = None
    session_complete: bool = False
    progress: Optional[dict] = None  # { "current": int, "total": int }
    streak_count: Optional[int] = None
    total_xp: Optional[int] = None
    xp_awarded: int = 0
    mastery_delta: float = 0.0
    mastery_improved_concept_ids: list[str] = Field(default_factory=list)
    is_repeat_submission: bool = False


class CompleteSprintRequest(BaseModel):
    session_id: str
    correct_count: Optional[int] = None  # Deprecated, used by v1
    total_questions: Optional[int] = None  # Deprecated, used by v1


class CompleteSprintResponse(BaseModel):
    xp_awarded: int
    new_streak: int
    new_total_xp: int
    message: str
