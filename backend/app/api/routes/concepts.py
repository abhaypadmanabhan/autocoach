"""Concepts API routes."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.routes.documents import get_user_id_from_token
from app.services.concepts import get_weakest_concepts

router = APIRouter()
logger = logging.getLogger(__name__)


class WeakConceptResponse(BaseModel):
    id: str
    concept_name: str
    document_id: str
    mastery_score: float
    mastery_percent: int
    times_tested: int


@router.get("/weakest", response_model=list[WeakConceptResponse])
async def get_weakest_concepts_endpoint(
    limit: int = Query(3, ge=1, le=10),
    user_id=Depends(get_user_id_from_token)
):
    """
    Get the user's weakest concepts.
    Returns concepts with lowest mastery scores that have been tested at least once.
    """
    try:
        concepts = get_weakest_concepts(str(user_id), limit=limit)
        return concepts
    except Exception as e:
        logger.error(f"Error key fetching weakest concepts: {e}")
        # Fail gracefully with empty list rather than 500
        return []
