from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class OnboardingResponse(BaseModel):
    has_completed: bool
    learning_topics: Optional[Dict[str, Any]] = None
    goal: Optional[str] = None
    study_frequency: Optional[str] = None
    experience_level: Optional[str] = None


class OnboardingCreate(BaseModel):
    learning_topics: Optional[Dict[str, Any]] = None
    goal: Optional[str] = None
    study_frequency: Optional[str] = None
    experience_level: Optional[str] = None
