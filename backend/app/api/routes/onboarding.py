import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.routes.documents import get_user_id_from_token
from app.core.supabase import supabase_admin
from app.schemas.onboarding import OnboardingCreate, OnboardingResponse

router = APIRouter()

logger = logging.getLogger(__name__)


def _as_dict(value: Any) -> dict[str, Any] | None:
    return value if isinstance(value, dict) else None


def _as_str(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


@router.get("", response_model=OnboardingResponse)
async def get_onboarding(
    user_id: UUID = Depends(get_user_id_from_token),
):
    """Get onboarding status and payload for the authenticated user."""
    try:
        response = (
            supabase_admin.table("user_onboarding")
            .select("learning_topics,goal,study_frequency,experience_level")
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
        )
        if response is None:
            raise HTTPException(
                status_code=500,
                detail="Supabase returned None (client/config/version issue) at get_onboarding",
            )

        rows = response.data or []
        raw_row = rows[0] if rows else None
        row = raw_row if isinstance(raw_row, dict) else None
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to load onboarding for user %s", user_id)
        raise HTTPException(status_code=500, detail="Failed to load onboarding from db")

    if not row:
        return OnboardingResponse(has_completed=False)

    learning_topics = _as_dict(row.get("learning_topics"))
    experience_level = _as_str(row.get("experience_level"))
    if not experience_level and learning_topics:
        nested_level = learning_topics.get("experience_level")
        if isinstance(nested_level, str) and nested_level:
            experience_level = nested_level

    if not experience_level:
        experience_level = "beginner"

    return OnboardingResponse(
        has_completed=True,
        learning_topics=learning_topics,
        goal=_as_str(row.get("goal")),
        study_frequency=_as_str(row.get("study_frequency")),
        experience_level=experience_level,
    )


@router.post("", response_model=OnboardingResponse)
async def save_onboarding(
    payload: OnboardingCreate,
    user_id: UUID = Depends(get_user_id_from_token),
):
    """Save onboarding responses for the authenticated user (upsert)."""
    try:
        existing_res = (
            supabase_admin.table("user_onboarding")
            .select("learning_topics,goal,study_frequency,experience_level")
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
        )
        if existing_res is None:
            raise HTTPException(
                status_code=500,
                detail="Supabase returned None at save_onboarding existing lookup",
            )

        existing_rows = existing_res.data or []
        raw_existing_row = existing_rows[0] if existing_rows else {}
        existing_row: dict[str, Any] = (
            raw_existing_row if isinstance(raw_existing_row, dict) else {}
        )

        existing_learning_topics = _as_dict(existing_row.get("learning_topics"))
        merged_learning_topics = dict(existing_learning_topics or {})

        if isinstance(payload.learning_topics, dict):
            merged_learning_topics.update(payload.learning_topics)

        existing_experience_level = _as_str(existing_row.get("experience_level"))
        if not existing_experience_level and existing_learning_topics:
            nested_level = existing_learning_topics.get("experience_level")
            if isinstance(nested_level, str) and nested_level:
                existing_experience_level = nested_level

        experience_level = (
            payload.experience_level or existing_experience_level or "beginner"
        )
        merged_learning_topics["experience_level"] = experience_level

        upsert_payload = {
            "user_id": str(user_id),
            "learning_topics": merged_learning_topics,
            "goal": payload.goal
            if payload.goal is not None
            else _as_str(existing_row.get("goal")),
            "study_frequency": payload.study_frequency
            if payload.study_frequency is not None
            else _as_str(existing_row.get("study_frequency")),
            "experience_level": experience_level,
        }

        upsert_res = (
            supabase_admin.table("user_onboarding")
            .upsert(upsert_payload, on_conflict="user_id")
            .execute()
        )
        if upsert_res is None:
            raise HTTPException(
                status_code=500, detail="Supabase returned None at save_onboarding"
            )
    except HTTPException:
        raise
    except Exception:
        # Was `except Exception as exc` with `exc` never used, so a real driver
        # error ("record \"new\" has no field \"updated_at\"") reached the client
        # as an opaque 500 and left no trace in the logs at all. Log it.
        logger.exception("Failed to save onboarding for user %s", user_id)
        raise HTTPException(status_code=500, detail="Failed to save onboarding to db")

    return OnboardingResponse(
        has_completed=True,
        learning_topics=upsert_payload.get("learning_topics", []),
        goal=upsert_payload.get("goal"),
        study_frequency=upsert_payload.get("study_frequency"),
        experience_level=upsert_payload.get("experience_level"),
    )
