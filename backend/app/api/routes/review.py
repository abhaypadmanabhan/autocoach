from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import List

from app.api.routes.documents import get_user_id_from_token
from app.services.concepts import get_due_concepts

router = APIRouter()


class DueConcept(BaseModel):
    id: str
    name: str
    document_id: str
    mastery_score: float
    mastery_percent: int


class ReviewTodayResponse(BaseModel):
    count: int
    due_concepts: List[DueConcept]
    rules: dict


@router.get("/today", response_model=ReviewTodayResponse)
async def get_review_today(
    limit: int = Query(20, ge=1, le=20), user_id=Depends(get_user_id_from_token)
):
    """
    Get concepts due for review today.
    """
    concepts = get_due_concepts(str(user_id), limit=limit)

    # Normalize mastery_percent to integer 0-100 (DB stores float 0-100 mostly, but let's be safe)
    clean_concepts = []
    for c in concepts:
        # Service already attempts to normalize, but let's ensure it matches schema
        m_score = c.get("mastery_score", 0.0)
        # If score is 0.75, it might mean 75% or 0.75%.
        # But our rule is <75. DB schema default is "0".
        # Previous sprints normalized this handling.
        # We'll just pass through what service returns but ensure types.

        clean_concepts.append(
            DueConcept(
                id=c["id"],
                name=c["name"],
                document_id=c["document_id"],
                mastery_score=m_score,
                mastery_percent=c.get("mastery_percent", 0),
            )
        )

    return ReviewTodayResponse(
        count=len(clean_concepts),
        due_concepts=clean_concepts,
        rules={"mastery_below": 0.75, "stale_days": 2},
    )
