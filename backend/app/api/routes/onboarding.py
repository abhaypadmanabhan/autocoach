from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.api.deps import get_current_user, get_db
from app.db.models import User, UserOnboarding
from app.schemas.onboarding import OnboardingCreate, OnboardingResponse

router = APIRouter()


@router.get("", response_model=OnboardingResponse)
async def get_onboarding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the onboarding status and payload for the current user.
    """
    stmt = select(UserOnboarding).where(UserOnboarding.user_id == current_user.id)
    result = await db.execute(stmt)
    onboarding = result.scalar_one_or_none()

    if not onboarding:
        return OnboardingResponse(has_completed=False)

    return OnboardingResponse(
        has_completed=True,
        learning_topics=onboarding.learning_topics,
        goal=onboarding.goal,
        study_frequency=onboarding.study_frequency,
    )


@router.post("", response_model=OnboardingResponse)
async def save_onboarding(
    payload: OnboardingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Save onboarding responses for the user (upsert).
    """
    stmt = select(UserOnboarding).where(UserOnboarding.user_id == current_user.id)
    result = await db.execute(stmt)
    onboarding = result.scalar_one_or_none()

    if onboarding:
        if payload.learning_topics is not None:
            onboarding.learning_topics = payload.learning_topics
        if payload.goal is not None:
            onboarding.goal = payload.goal
        if payload.study_frequency is not None:
            onboarding.study_frequency = payload.study_frequency
    else:
        onboarding = UserOnboarding(
            user_id=current_user.id,
            learning_topics=payload.learning_topics,
            goal=payload.goal,
            study_frequency=payload.study_frequency,
        )
        db.add(onboarding)

    await db.commit()
    await db.refresh(onboarding)

    return OnboardingResponse(
        has_completed=True,
        learning_topics=onboarding.learning_topics,
        goal=onboarding.goal,
        study_frequency=onboarding.study_frequency,
    )
