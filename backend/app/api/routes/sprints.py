import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Body

from app.api.routes.documents import get_user_id_from_token
from app.core.supabase import supabase_admin
from app.models.sprint import (
    SprintStatusResponse,
    StartSprintResponse,
    StartSprintRequest,
    SprintAnswerRequest,
    SprintAnswerResponse,
    CompleteSprintRequest,
    CompleteSprintResponse,
)
from app.services.answer_evaluator import evaluate_answer
from app.services.session_manager import (
    create_session,
    _update_concept_mastery,
    _recompute_document_progress,
    _recompute_session_counts,
)
from app.services.usage import (
    consume_sprint_usage_or_429,
    get_or_create_daily_usage,
    QUIZ_LIMIT,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def _get_mastery_scores(user_id: UUID, concept_ids: list[str]) -> dict[str, float]:
    if not concept_ids:
        return {}

    response = (
        supabase_admin.table("user_concept_mastery")
        .select("concept_id,mastery_score")
        .eq("user_id", str(user_id))
        .in_("concept_id", concept_ids)
        .execute()
    )

    rows = response.data or []
    return {
        str(row.get("concept_id")): float(row.get("mastery_score") or 0.0)
        for row in rows
        if row.get("concept_id") is not None
    }


def _ensure_user_profile(user_id: UUID) -> dict:
    response = (
        supabase_admin.table("users").select("*").eq("id", str(user_id)).execute()
    )

    if response.data:
        return _as_dict(response.data[0])

    logger.info("Creating user profile for %s", user_id)
    new_user = {
        "id": str(user_id),
        "streak_count": 0,
        "total_xp": 0,
    }
    insert_res = supabase_admin.table("users").insert(new_user).execute()
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to retrieve user profile")
    return _as_dict(insert_res.data[0])


def _select_target_document(user_id: UUID) -> str:
    mastery_res = (
        supabase_admin.table("user_concept_mastery")
        .select("concept_id, mastery_score, concept:concepts(document_id)")
        .eq("user_id", str(user_id))
        .lt("mastery_score", 80)
        .execute()
    )

    target_document_id = None
    if mastery_res.data:
        doc_counts: dict[str, int] = {}
        for raw_item in mastery_res.data:
            item = _as_dict(raw_item)
            concept = _as_dict(item.get("concept"))
            if not concept:
                continue
            doc_id = concept.get("document_id")
            if not doc_id:
                continue
            doc_counts[doc_id] = doc_counts.get(doc_id, 0) + 1

        if doc_counts:
            target_document_id = max(doc_counts, key=lambda k: doc_counts[k])

    if not target_document_id:
        docs_res = (
            supabase_admin.table("documents")
            .select("id")
            .eq("user_id", str(user_id))
            .eq("status", "ready")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if docs_res.data:
            doc_row = _as_dict(docs_res.data[0])
            target_document_id = doc_row.get("id")

    if not target_document_id:
        raise HTTPException(
            status_code=400,
            detail="No documents available to sprint on. Please upload a document first.",
        )

    return str(target_document_id)


def _get_document_title(document_id: str) -> str:
    doc_res = (
        supabase_admin.table("documents")
        .select("filename, ai_title")
        .eq("id", document_id)
        .single()
        .execute()
    )
    if not doc_res.data:
        return ""
    doc_data = _as_dict(doc_res.data)
    return doc_data.get("ai_title") or doc_data.get("filename") or ""


def _fetch_session_questions(
    session_id: str, difficulty: str, total_questions: int
) -> tuple[list[dict], int, int | None]:
    questions_res = (
        supabase_admin.table("questions")
        .select(
            "id, question_number, question_type, question_text, options, user_answer"
        )
        .eq("session_id", session_id)
        .order("question_number")
        .execute()
    )

    questions = questions_res.data or []
    answered_count = 0
    for raw in questions:
        q = _as_dict(raw)
        if q.get("user_answer") is not None:
            answered_count += 1
    next_question_number = None
    for raw in questions:
        q = _as_dict(raw)
        if q.get("user_answer") is None:
            next_question_number = q.get("question_number")
            break

    response_questions: list[dict] = []
    for raw in questions:
        q = _as_dict(raw)
        response_questions.append(
            {
                "question_id": q.get("id"),
                "question_number": q.get("question_number"),
                "total_questions": total_questions,
                "question_type": q.get("question_type"),
                "question_text": q.get("question_text"),
                "options": q.get("options"),
                "difficulty": difficulty,
            }
        )

    return response_questions, answered_count, next_question_number


def _get_today_session(user_id: UUID) -> dict | None:
    today = datetime.utcnow().date()
    today_str = today.isoformat()
    sess_res = (
        supabase_admin.table("quiz_sessions")
        .select(
            "id, document_id, status, total_questions, answered_questions, difficulty, created_at"
        )
        .eq("user_id", str(user_id))
        .gte("created_at", today_str)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not sess_res.data:
        return None
    return _as_dict(sess_res.data[0])


def _create_sprint_session(user_id: UUID) -> dict:
    target_document_id = _select_target_document(user_id)
    doc_title = _get_document_title(target_document_id)

    session_data = create_session(
        user_id=str(user_id),
        document_id=target_document_id,
        num_questions=5,
        difficulty="medium",
        question_types=["mcq", "true_false"],
    )

    session_id = session_data["session_id"]
    total_questions = session_data.get("total_questions", 5)
    questions, answered_count, next_question_number = _fetch_session_questions(
        session_id=session_id,
        difficulty="medium",
        total_questions=total_questions,
    )

    return {
        "session_id": session_id,
        "document_id": target_document_id,
        "document_title": doc_title,
        "questions": questions,
        "answered_count": answered_count,
        "next_question_number": next_question_number,
        "total_questions": total_questions,
    }


def get_sprint_today(user_id: UUID) -> SprintStatusResponse:
    user_data = _ensure_user_profile(user_id)
    last_date = user_data.get("last_sprint_date")
    streak = user_data.get("streak_count", 0)
    xp = user_data.get("total_xp", 0)
    last_date_obj = None

    today = datetime.utcnow().date()
    is_done_today = False
    if last_date:
        last_date_obj = (
            datetime.fromisoformat(last_date).date()
            if isinstance(last_date, str)
            else last_date
        )
        if last_date_obj == today:
            is_done_today = True

    # Calculate credits
    usage = get_or_create_daily_usage(user_id)
    allowed = QUIZ_LIMIT + usage.get("extra_quizzes", 0)
    credits_remaining = max(0, allowed - usage.get("quizzes_used", 0))

    session = _get_today_session(user_id)
    if session:
        session = _as_dict(session)
        session_id = session.get("id")
        document_id = session.get("document_id")
        if not session_id or not document_id:
            raise HTTPException(status_code=500, detail="Invalid sprint session state")

        questions, answered_count, next_question_number = _fetch_session_questions(
            session_id=str(session_id),
            difficulty=session.get("difficulty", "medium"),
            total_questions=session.get("total_questions", 0),
        )
        doc_title = _get_document_title(str(document_id))
        status = "completed" if session.get("status") == "completed" else "active"
        completed_today = is_done_today or session.get("status") == "completed"
        progress_current = (
            session.get("total_questions", 0)
            if session.get("status") == "completed"
            else answered_count
        )

        return SprintStatusResponse(
            status=status,
            streak_count=streak,
            total_xp=xp,
            last_sprint_date=last_date_obj if last_date else None,
            next_sprint_available_at=None,
            completed_today=completed_today,
            session_id=session.get("id"),
            document_title=doc_title,
            questions=questions,
            next_question_number=next_question_number,
            progress={
                "current": progress_current,
                "total": session.get("total_questions", 0),
            },
            quiz_credits=credits_remaining,
        )

    if is_done_today:
        return SprintStatusResponse(
            status="completed",
            streak_count=streak,
            total_xp=xp,
            last_sprint_date=last_date_obj if last_date else None,
            next_sprint_available_at=None,
            completed_today=True,
            session_id=None,
            document_title=None,
            questions=[],
            next_question_number=None,
            progress={"current": 5, "total": 5},
            quiz_credits=credits_remaining,
        )

    created = _create_sprint_session(user_id)

    return SprintStatusResponse(
        status="active",
        streak_count=streak,
        total_xp=xp,
        last_sprint_date=last_date_obj if last_date else None,
        next_sprint_available_at=None,
        completed_today=False,
        session_id=created["session_id"],
        document_title=created["document_title"],
        questions=created["questions"],
        next_question_number=created["next_question_number"],
        progress={
            "current": created["answered_count"],
            "total": created["total_questions"],
        },
        quiz_credits=credits_remaining,
    )


def start_sprint_session(user_id: UUID) -> StartSprintResponse:
    created = _create_sprint_session(user_id)
    return StartSprintResponse(
        session_id=created["session_id"],
        document_id=created["document_id"],
        document_title=created["document_title"],
        questions=created["questions"],
    )


def answer_sprint_question(
    request: SprintAnswerRequest, user_id: UUID
) -> SprintAnswerResponse:
    session_res = (
        supabase_admin.table("quiz_sessions")
        .select("*")
        .eq("id", request.session_id)
        .eq("user_id", str(user_id))
        .execute()
    )
    if not session_res.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session = _as_dict(session_res.data[0])

    question_res = (
        supabase_admin.table("questions")
        .select("*")
        .eq("id", request.question_id)
        .eq("session_id", request.session_id)
        .execute()
    )
    if not question_res.data:
        raise HTTPException(status_code=404, detail="Question not found")

    question = _as_dict(question_res.data[0])

    if question.get("user_answer") is not None:
        answered, correct = _recompute_session_counts(request.session_id)
        next_question = _get_next_question_pointer(request.session_id)
        stats = _get_user_stats(user_id)
        total_questions = session.get("total_questions", 0)
        return SprintAnswerResponse(
            correct=bool(question.get("is_correct")),
            explanation=question.get("explanation"),
            feedback=None,
            correct_answer=question.get("correct_answer"),
            next_question_id=next_question.get("question_id")
            if next_question
            else None,
            next_question_number=next_question.get("question_number")
            if next_question
            else None,
            session_complete=answered >= total_questions,
            progress={"current": answered, "total": total_questions},
            streak_count=stats["streak_count"],
            total_xp=stats["total_xp"],
            xp_awarded=0,
            mastery_delta=0.0,
            mastery_improved_concept_ids=[],
            is_repeat_submission=True,
        )

    if session.get("status") != "active":
        raise HTTPException(
            status_code=409,
            detail=f"Session is not active (status: {session.get('status')})",
        )

    question_type = question.get("question_type")
    correct_answer = question.get("correct_answer")
    question_text = question.get("question_text")
    if not question_type or correct_answer is None or question_text is None:
        raise HTTPException(status_code=500, detail="Invalid question state")

    eval_result = evaluate_answer(
        question_type=str(question_type),
        user_answer=request.answer,
        correct_answer=str(correct_answer),
        question_text=str(question_text),
    )

    is_correct = eval_result["is_correct"]
    xp_awarded = 10 if is_correct else 5
    feedback = eval_result.get("feedback")
    now = datetime.now(timezone.utc).isoformat()

    q_concept_ids = [str(cid) for cid in (question.get("concept_ids") or [])]
    before_scores = _get_mastery_scores(user_id, q_concept_ids)

    update_res = (
        supabase_admin.table("questions")
        .update(
            {
                "user_answer": request.answer,
                "is_correct": is_correct,
                "input_method": "click",
                "answered_at": now,
            }
        )
        .eq("id", request.question_id)
        .eq("session_id", request.session_id)
        .is_("user_answer", None)
        .execute()
    )

    if not update_res.data:
        latest_question = (
            supabase_admin.table("questions")
            .select("*")
            .eq("id", request.question_id)
            .eq("session_id", request.session_id)
            .execute()
        )
        if not latest_question.data:
            raise HTTPException(status_code=404, detail="Question not found")
        question = _as_dict(latest_question.data[0])
        answered, correct = _recompute_session_counts(request.session_id)
        next_question = _get_next_question_pointer(request.session_id)
        stats = _get_user_stats(user_id)
        total_questions = session.get("total_questions", 0)
        return SprintAnswerResponse(
            correct=bool(question.get("is_correct")),
            explanation=question.get("explanation"),
            feedback=None,
            correct_answer=question.get("correct_answer"),
            next_question_id=next_question.get("question_id")
            if next_question
            else None,
            next_question_number=next_question.get("question_number")
            if next_question
            else None,
            session_complete=answered >= total_questions,
            progress={"current": answered, "total": total_questions},
            streak_count=stats["streak_count"],
            total_xp=stats["total_xp"],
            xp_awarded=0,
            mastery_delta=0.0,
            mastery_improved_concept_ids=[],
            is_repeat_submission=True,
        )

    mastery_delta = 0.0
    improved_concept_ids: list[str] = []
    try:
        if q_concept_ids:
            _update_concept_mastery(str(user_id), q_concept_ids, is_correct)
            document_id = session.get("document_id")
            if document_id:
                _recompute_document_progress(str(user_id), str(document_id))

            after_scores = _get_mastery_scores(user_id, q_concept_ids)
            mastery_delta = round(
                sum(
                    after_scores.get(concept_id, 0.0)
                    - before_scores.get(concept_id, 0.0)
                    for concept_id in q_concept_ids
                ),
                2,
            )
            improved_concept_ids = [
                concept_id
                for concept_id in q_concept_ids
                if after_scores.get(concept_id, 0.0)
                > before_scores.get(concept_id, 0.0)
            ]
    except Exception as e:
        logger.error("Failed to update mastery/progress: %s", e)

    answered, correct = _recompute_session_counts(request.session_id)
    session_update: dict[str, Any] = {
        "answered_questions": answered,
        "correct_answers": correct,
    }

    total_questions = session.get("total_questions", 0)
    is_complete = answered >= total_questions
    if is_complete:
        session_update["status"] = "completed"
        session_update["completed_at"] = now

    supabase_admin.table("quiz_sessions").update(session_update).eq(
        "id", request.session_id
    ).execute()

    next_question = None
    if not is_complete:
        next_question = _get_next_question_pointer(request.session_id)

    stats = _get_user_stats(user_id)
    return SprintAnswerResponse(
        correct=is_correct,
        explanation=question.get("explanation"),
        feedback=feedback,
        correct_answer=question.get("correct_answer"),
        next_question_id=next_question.get("question_id") if next_question else None,
        next_question_number=next_question.get("question_number")
        if next_question
        else None,
        session_complete=is_complete,
        progress={"current": answered, "total": total_questions},
        streak_count=stats["streak_count"],
        total_xp=stats["total_xp"],
        xp_awarded=xp_awarded,
        mastery_delta=mastery_delta,
        mastery_improved_concept_ids=improved_concept_ids,
        is_repeat_submission=False,
    )


def _get_next_question_pointer(session_id: str) -> dict | None:
    next_q_response = (
        supabase_admin.table("questions")
        .select("id, question_number")
        .eq("session_id", session_id)
        .is_("user_answer", None)
        .order("question_number")
        .limit(1)
        .execute()
    )
    if not next_q_response.data:
        return None
    next_q = _as_dict(next_q_response.data[0])
    return {
        "question_id": next_q.get("id"),
        "question_number": next_q.get("question_number"),
    }


def _get_user_stats(user_id: UUID) -> dict:
    user_res = (
        supabase_admin.table("users")
        .select("streak_count,total_xp")
        .eq("id", str(user_id))
        .single()
        .execute()
    )
    if not user_res.data:
        return {"streak_count": 0, "total_xp": 0}
    user_data = _as_dict(user_res.data)
    return {
        "streak_count": user_data.get("streak_count", 0),
        "total_xp": user_data.get("total_xp", 0),
    }


def complete_sprint_session(
    request: CompleteSprintRequest, user_id: UUID
) -> CompleteSprintResponse:
    user_res = (
        supabase_admin.table("users")
        .select("*")
        .eq("id", str(user_id))
        .single()
        .execute()
    )
    if not user_res.data:
        raise HTTPException(status_code=404, detail="User not found")

    user_data = _as_dict(user_res.data)
    current_xp = int(user_data.get("total_xp") or 0)
    current_streak = int(user_data.get("streak_count") or 0)
    last_date = user_data.get("last_sprint_date")

    now = datetime.utcnow()
    today = now.date()
    is_already_done_today = False

    if last_date:
        last_date_obj = (
            datetime.fromisoformat(last_date).date()
            if isinstance(last_date, str)
            else last_date
        )
        if last_date_obj == today:
            is_already_done_today = True

    if is_already_done_today:
        return CompleteSprintResponse(
            xp_awarded=0,
            new_streak=current_streak,
            new_total_xp=current_xp,
            message="Sprint already completed today",
        )

    sess_res = (
        supabase_admin.table("quiz_sessions")
        .select("*")
        .eq("id", request.session_id)
        .single()
        .execute()
    )
    if not sess_res.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session = _as_dict(sess_res.data)
    correct_count = int(session.get("correct_answers") or 0)

    xp_gain = 100 + (correct_count * 10)

    new_streak = current_streak
    if last_date:
        last_date_obj = (
            datetime.fromisoformat(last_date).date()
            if isinstance(last_date, str)
            else last_date
        )
        if (today - last_date_obj).days == 1:
            new_streak += 1
        elif (today - last_date_obj).days > 1:
            new_streak = 1
    else:
        new_streak = 1

    update_data = {
        "total_xp": current_xp + xp_gain,
        "streak_count": new_streak,
        "last_sprint_date": now.isoformat(),
    }

    supabase_admin.table("users").update(update_data).eq("id", str(user_id)).execute()

    supabase_admin.table("quiz_sessions").update(
        {"status": "completed", "completed_at": now.isoformat()}
    ).eq("id", request.session_id).execute()

    message = f"Streak Extended! {new_streak} Days!"
    return CompleteSprintResponse(
        xp_awarded=xp_gain,
        new_streak=new_streak,
        new_total_xp=current_xp + xp_gain,
        message=message,
    )


@router.get("/today", response_model=SprintStatusResponse)
async def get_sprint_status(user_id: UUID = Depends(get_user_id_from_token)):
    try:
        return get_sprint_today(user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error fetching sprint status: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch sprint status")


def get_session_creator():
    return start_sprint_session


@router.post("/start", response_model=StartSprintResponse)
async def start_sprint(
    request: StartSprintRequest = Body(...),
    user_id: UUID = Depends(get_user_id_from_token),
    session_creator=Depends(get_session_creator),
):
    try:
        existing = _get_today_session(user_id)
        if existing and existing.get("status") == "active":
            session_id = str(existing.get("id"))
            total_questions = int(existing.get("total_questions") or 0)
            questions, _, _ = _fetch_session_questions(
                session_id=session_id,
                difficulty=str(existing.get("difficulty") or "medium"),
                total_questions=total_questions,
            )
            return StartSprintResponse(
                session_id=session_id,
                document_id=str(existing.get("document_id")),
                document_title=_get_document_title(str(existing.get("document_id"))),
                questions=questions,
            )

        response = session_creator(user_id)

        try:
            consume_sprint_usage_or_429(user_id)
        except HTTPException as exc:
            if exc.status_code == 429:
                supabase_admin.table("questions").delete().eq(
                    "session_id", response.session_id
                ).execute()
                supabase_admin.table("quiz_sessions").delete().eq(
                    "id", response.session_id
                ).execute()
            raise

        return response
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
