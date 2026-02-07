from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional

class SprintStatusResponse(BaseModel):
    status: str  # "ready", "completed"
    streak_count: int
    total_xp: int
    last_sprint_date: Optional[date]
    next_sprint_available_at: Optional[datetime]

class StartSprintRequest(BaseModel):
    pass

class StartSprintResponse(BaseModel):
    session_id: str
    document_id: str
    document_title: str

class CompleteSprintRequest(BaseModel):
    session_id: str
    correct_count: int
    total_questions: int

class CompleteSprintResponse(BaseModel):
    xp_awarded: int
    new_streak: int
    new_total_xp: int
    message: str
