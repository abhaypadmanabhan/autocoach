import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Body

from app.api.routes.documents import get_user_id_from_token
from app.models.sprint import (
    SprintStatusResponse,
    StartSprintResponse,
    StartSprintRequest,
    SprintAnswerRequest,
    SprintAnswerResponse,
    CompleteSprintRequest,
    CompleteSprintResponse,
)
from app.api.routes.sprints import (
    get_sprint_today,
    start_sprint_session,
    answer_sprint_question,
    complete_sprint_session,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=SprintStatusResponse)
async def get_sprint_status(user_id: UUID = Depends(get_user_id_from_token)):
    try:
        return get_sprint_today(user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error fetching sprint status: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch sprint status")


@router.post("/start", response_model=StartSprintResponse)
async def start_sprint(
    request: StartSprintRequest = Body(...),
    user_id: UUID = Depends(get_user_id_from_token),
):
    try:
        return start_sprint_session(user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error starting sprint: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to start sprint")


@router.post("/answer", response_model=SprintAnswerResponse)
async def answer_sprint(
    request: SprintAnswerRequest,
    user_id: UUID = Depends(get_user_id_from_token),
):
    try:
        return answer_sprint_question(request, user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error submitting answer: %s", e)
        raise HTTPException(status_code=500, detail="Failed to submit answer")


@router.post("/complete", response_model=CompleteSprintResponse)
async def complete_sprint(
    request: CompleteSprintRequest,
    user_id: UUID = Depends(get_user_id_from_token),
):
    try:
        return complete_sprint_session(request, user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error completing sprint: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to complete sprint")
