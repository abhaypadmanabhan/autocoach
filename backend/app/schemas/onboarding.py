import json
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator

# Hard cap to prevent JSON-bomb writes via service-role client (RLS bypassed).
MAX_LEARNING_TOPICS_BYTES = 10_000


class OnboardingResponse(BaseModel):
    has_completed: bool
    learning_topics: Optional[Dict[str, Any]] = None
    goal: Optional[str] = None
    study_frequency: Optional[str] = None
    experience_level: Optional[str] = None


class OnboardingCreate(BaseModel):
    learning_topics: Optional[Dict[str, Any]] = None
    goal: Optional[str] = Field(default=None, max_length=500)
    study_frequency: Optional[str] = Field(default=None, max_length=100)
    experience_level: Optional[str] = Field(default=None, max_length=100)

    @field_validator("learning_topics")
    @classmethod
    def _cap_topics_size(cls, v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if v is None:
            return v
        if len(json.dumps(v)) > MAX_LEARNING_TOPICS_BYTES:
            raise ValueError(
                f"learning_topics exceeds {MAX_LEARNING_TOPICS_BYTES}-byte cap"
            )
        return v
