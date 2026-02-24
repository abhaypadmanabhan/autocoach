from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.routes.documents import get_user_id_from_token
from app.core.supabase import supabase_admin
from app.schemas.onboarding import OnboardingCreate, OnboardingResponse

router = APIRouter()


@router.get("", response_model=OnboardingResponse)
async def get_onboarding(
    user_id: UUID = Depends(get_user_id_from_token),
):
    """Get onboarding status and payload for the authenticated user."""
    try:
        response = (
            supabase_admin.table("user_onboarding")
            .select("learning_topics, goal, study_frequency")
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
        onboarding = response.data
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to load onboarding: {str(exc)}"
        )

    if not onboarding:
        return OnboardingResponse(has_completed=False)

    return OnboardingResponse(
        has_completed=True,
        learning_topics=onboarding.get("learning_topics"),
        goal=onboarding.get("goal"),
        study_frequency=onboarding.get("study_frequency"),
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
            .select("learning_topics, goal, study_frequency")
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
        existing = existing_res.data or {}

        upsert_payload = {
            "user_id": str(user_id),
            "learning_topics": (
                payload.learning_topics
                if payload.learning_topics is not None
                else existing.get("learning_topics")
            ),
            "goal": payload.goal if payload.goal is not None else existing.get("goal"),
            "study_frequency": (
                payload.study_frequency
                if payload.study_frequency is not None
                else existing.get("study_frequency")
            ),
        }

        supabase_admin.table("user_onboarding").upsert(
            upsert_payload, on_conflict="user_id"
        ).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to save onboarding: {str(exc)}"
        )

    return OnboardingResponse(
        has_completed=True,
        learning_topics=upsert_payload.get("learning_topics"),
        goal=upsert_payload.get("goal"),
        study_frequency=upsert_payload.get("study_frequency"),
    )
