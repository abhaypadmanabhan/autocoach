import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.routes.documents import get_user_id_from_token
from app.core.supabase import supabase_admin
from app.schemas.onboarding import OnboardingCreate, OnboardingResponse

router = APIRouter()

logger = logging.getLogger(__name__)


@router.get("", response_model=OnboardingResponse)
async def get_onboarding(
    user_id: UUID = Depends(get_user_id_from_token),
):
    """Get onboarding status and payload for the authenticated user."""
    try:
        response = (
            supabase_admin.table("user_onboarding")
            .select("learning_topics,goal,study_frequency")
            .eq("user_id", str(user_id))
            .limit(1)
            .execute()
        )
        if response is None:
            raise HTTPException(
                status_code=500, detail="Supabase returned None (client/config/version issue) at get_onboarding"
            )
        
        rows = response.data or []
        row = rows[0] if rows else None
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail="Failed to load onboarding from db"
        )

    if not row:
        return OnboardingResponse(has_completed=False)

    learning_topics = row.get("learning_topics") or []

    return OnboardingResponse(
        has_completed=True,
        learning_topics=learning_topics,
        goal=row.get("goal"),
        study_frequency=row.get("study_frequency"),
    )


@router.post("", response_model=OnboardingResponse)
async def save_onboarding(
    payload: OnboardingCreate,
    user_id: UUID = Depends(get_user_id_from_token),
):
    """Save onboarding responses for the authenticated user (upsert)."""
    try:
        upsert_payload = {
            "user_id": str(user_id),
            "learning_topics": payload.learning_topics or [],
            "goal": payload.goal,
            "study_frequency": payload.study_frequency,
        }

        upsert_res = (
            supabase_admin.table("user_onboarding")
            .upsert(upsert_payload, on_conflict="user_id")
            .execute()
        )
        if upsert_res is None:
            raise HTTPException(status_code=500, detail="Supabase returned None at save_onboarding")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail="Failed to save onboarding to db"
        )

    return OnboardingResponse(
        has_completed=True,
        learning_topics=upsert_payload.get("learning_topics", []),
        goal=upsert_payload.get("goal"),
        study_frequency=upsert_payload.get("study_frequency"),
    )
