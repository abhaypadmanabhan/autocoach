"""Quiz session API routes."""

import logging

from fastapi import APIRouter, HTTPException, Depends
from uuid import UUID

from app.config import get_settings
from app.models.quiz import (
    QuizSessionCreate,
    QuestionResponse,
    AnswerSubmit,
    AnswerResponse,
    AnswerResult,
    SessionStatus,
    SessionQuestionDetail,
)
from app.services.session_manager import (
    create_session,
    get_session,
    submit_answer,
    get_current_question,
)
from app.services.usage import consume_quiz_usage_or_429
from app.api.routes.documents import get_user_id_from_token
from app.core.supabase import supabase_admin
from app.core.rate_limit import rate_limiter

logger = logging.getLogger(__name__)

router = APIRouter()
settings = get_settings()


def enforce_quiz_rate_limit(user_id=Depends(get_user_id_from_token)):
    rate_limiter.check(
        key=f"quiz:{user_id}",
        requests_per_window=settings.quiz_requests_per_minute,
        window_seconds=60,
    )
    return user_id


@router.post("/", response_model=dict)
async def create_quiz_session(
    request: QuizSessionCreate, user_id=Depends(enforce_quiz_rate_limit)
):
    """
    Create a new interactive quiz session.

    Args:
        request: The session creation request.
        user_id: The authenticated user's ID.

    Returns:
        Dictionary with session_id and first question.

    Raises:
        HTTPException: 404 if document not found, 400 if not ready, 500 on error.
    """
    try:
        # Verify document exists and belongs to user
        doc_response = (
            supabase_admin.table("documents")
            .select("*")
            .eq("id", request.document_id)
            .eq("user_id", str(user_id))
            .execute()
        )

        if not doc_response.data or len(doc_response.data) == 0:
            raise HTTPException(status_code=404, detail="Document not found")

        doc = doc_response.data[0]

        # Verify document is ready
        if doc["status"] != "ready":
            raise HTTPException(
                status_code=400,
                detail=f"Document is not ready for quiz. Current status: {doc['status']}",
            )

        if request.focus_concept_ids:
            if len(request.focus_concept_ids) > 3:
                raise HTTPException(
                    status_code=400, detail="Maximum 3 focus concepts allowed."
                )

            # Check for duplicates
            if len(set(request.focus_concept_ids)) != len(request.focus_concept_ids):
                raise HTTPException(
                    status_code=400, detail="Duplicate focus concept IDs requested."
                )

            # Validate UUID format
            try:
                for cid in request.focus_concept_ids:
                    UUID(cid)
            except ValueError:
                raise HTTPException(
                    status_code=400, detail="Invalid UUID format in focus_concept_ids."
                )

        # Create session
        session_data = create_session(
            user_id=str(user_id),
            document_id=request.document_id,
            num_questions=request.num_questions,
            difficulty=request.difficulty,
            question_types=request.question_types,
            focus_concept_ids=request.focus_concept_ids,
        )

        try:
            consume_quiz_usage_or_429(user_id)
        except HTTPException as exc:
            if exc.status_code == 429:
                supabase_admin.table("questions").delete().eq(
                    "session_id", session_data["session_id"]
                ).execute()
                supabase_admin.table("quiz_sessions").delete().eq(
                    "id", session_data["session_id"]
                ).execute()
            raise

        return session_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create quiz session: {e}")
        logger.error("Failed to create quiz session: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail="Failed to create quiz session"
        )


@router.get("/{session_id}", response_model=SessionStatus)
async def get_session_status(session_id: UUID, user_id=Depends(enforce_quiz_rate_limit)):
    """
    Get the status of a quiz session.

    Args:
        session_id: The session ID.
        user_id: The authenticated user's ID.

    Returns:
        SessionStatus with all questions and progress.

    Raises:
        HTTPException: 404 if session not found.
    """
    try:
        session = get_session(str(session_id), str(user_id))

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        return SessionStatus(
            session_id=session["session_id"],
            document_id=session["document_id"],
            status=session["status"],
            difficulty=session["difficulty"],
            total_questions=session["total_questions"],
            answered_questions=session["answered_questions"],
            correct_answers=session["correct_answers"],
            score_percentage=session["score_percentage"],
            questions=[SessionQuestionDetail(**q) for q in session["questions"]],
            started_at=session["started_at"],
            completed_at=session["completed_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get session status: {e}")
        logger.error("Failed to get session status: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail="Failed to get session status"
        )


@router.get("/{session_id}/current", response_model=QuestionResponse)
async def get_current_quiz_question(
    session_id: UUID, user_id=Depends(enforce_quiz_rate_limit)
):
    """
    Get the current (next unanswered) question in a session.

    Args:
        session_id: The session ID.
        user_id: The authenticated user's ID.

    Returns:
        QuestionResponse with the current question.

    Raises:
        HTTPException: 404 if session not found or complete, 410 if session not active.
    """
    try:
        # Verify session exists and belongs to user
        session_response = (
            supabase_admin.table("quiz_sessions")
            .select("*")
            .eq("id", str(session_id))
            .eq("user_id", str(user_id))
            .execute()
        )

        if not session_response.data:
            raise HTTPException(status_code=404, detail="Session not found")

        session = session_response.data[0]

        if session["status"] != "active":
            raise HTTPException(
                status_code=410,
                detail=f"Session is not active (status: {session['status']})",
            )

        question = get_current_question(str(session_id), str(user_id))

        if not question:
            raise HTTPException(
                status_code=404, detail="No more questions - quiz is complete"
            )

        return QuestionResponse(
            question_id=question["question_id"],
            question_number=question["question_number"],
            total_questions=question["total_questions"],
            question_type=question["question_type"],
            question_text=question["question_text"],
            options=question["options"],
            difficulty=question["difficulty"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get current question: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail="Failed to get current question"
        )


@router.post("/{session_id}/answer", response_model=AnswerResponse)
async def submit_quiz_answer(
    session_id: UUID,
    question_id: UUID,
    answer_data: AnswerSubmit,
    user_id=Depends(enforce_quiz_rate_limit),
):
    """
    Submit an answer for a question in a session.

    Args:
        session_id: The session ID.
        question_id: The question ID being answered.
        answer_data: The answer submission.
        user_id: The authenticated user's ID.

    Returns:
        AnswerResponse with result and next question (if any).

    Raises:
        HTTPException: 404 if session/question not found, 400 if already answered.
    """
    try:
        result = submit_answer(
            session_id=str(session_id),
            user_id=str(user_id),
            question_id=str(question_id),
            answer=answer_data.answer,
            input_method=answer_data.input_method,
        )

        # Format next question if exists
        next_question = None
        if result["next_question"]:
            q = result["next_question"]
            next_question = QuestionResponse(
                question_id=q["question_id"],
                question_number=q["question_number"],
                total_questions=q["total_questions"],
                question_type=q["question_type"],
                question_text=q["question_text"],
                options=q["options"],
                difficulty=q["difficulty"],
            )

        return AnswerResponse(
            result=AnswerResult(
                is_correct=result["result"]["is_correct"],
                correct_answer=result["result"]["correct_answer"],
                explanation=result["result"]["explanation"],
                score_so_far=result["result"]["score_so_far"],
                total_answered=result["result"]["total_answered"],
                feedback=result["result"].get("feedback"),
                xp_awarded=result["result"].get("xp_awarded", 0),
                mastery_delta=result["result"].get("mastery_delta", 0.0),
            ),
            next_question=next_question,
            session_complete=result["session_complete"],
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Failed to submit answer: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500, detail="Failed to submit answer"
        )
