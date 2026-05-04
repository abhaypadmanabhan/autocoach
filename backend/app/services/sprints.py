"""Daily sprint service logic."""

import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.supabase import supabase_admin
from app.services.concepts import get_document_concepts
from app.services.session_manager import create_session, submit_answer

logger = logging.getLogger(__name__)


DEFAULT_NUM_QUESTIONS = 5
DEFAULT_DIFFICULTY = "medium"
DEFAULT_QUESTION_TYPES = ["text_mcq", "text_tf", "text_free"]


def _utc_today_date_str() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _utc_yesterday_date_str() -> str:
    return (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()


def _get_or_create_user_stats(user_id: str) -> dict:
    stats_response = (
        supabase_admin.table("user_stats").select("*").eq("user_id", user_id).execute()
    )

    if stats_response.data:
        return stats_response.data[0]

    now = datetime.now(timezone.utc).isoformat()
    new_stats = {
        "user_id": user_id,
        "xp_total": 0,
        "streak_current": 0,
        "streak_best": 0,
        "last_active_date": None,
        "updated_at": now,
    }
    insert_response = supabase_admin.table("user_stats").insert(new_stats).execute()
    return insert_response.data[0] if insert_response.data else new_stats


def _select_target_concepts(document_id: str, user_id: str) -> list[str]:
    concepts = get_document_concepts(document_id, user_id)
    if not concepts:
        return []

    weak_core = [
        c
        for c in concepts
        if c.get("importance_score", 0) >= 0.6 and c.get("mastery_score", 0) < 80.0
    ]

    if weak_core:
        weak_core.sort(key=lambda x: x.get("mastery_score", 0))
        weak_core.sort(key=lambda x: x.get("importance_score", 0), reverse=True)
        selected = weak_core[:3]
    else:
        core = [c for c in concepts if c.get("importance_score", 0) >= 0.6]
        core.sort(key=lambda x: x.get("importance_score", 0), reverse=True)
        selected = core[:3]

    return [str(c["id"]) for c in selected]


def _fetch_sprint_questions(session_id: str) -> list[dict]:
    session_response = (
        supabase_admin.table("quiz_sessions")
        .select("difficulty,total_questions")
        .eq("id", session_id)
        .execute()
    )
    session = (
        session_response.data[0]
        if session_response.data
        else {
            "difficulty": DEFAULT_DIFFICULTY,
            "total_questions": DEFAULT_NUM_QUESTIONS,
        }
    )

    questions_response = (
        supabase_admin.table("questions")
        .select("id,question_number,question_type,question_text,options")
        .eq("session_id", session_id)
        .order("question_number")
        .execute()
    )
    questions = questions_response.data or []

    return [
        {
            "question_id": q["id"],
            "question_number": q["question_number"],
            "total_questions": session["total_questions"],
            "question_type": q["question_type"],
            "question_text": q["question_text"],
            "options": q.get("options"),
            "difficulty": session["difficulty"],
        }
        for q in questions
    ]


def get_or_create_today_sprint(user_id: str) -> dict:
    today = _utc_today_date_str()

    sprint_response = (
        supabase_admin.table("daily_sprints")
        .select("*")
        .eq("user_id", user_id)
        .eq("sprint_date", today)
        .execute()
    )

    if sprint_response.data:
        sprint = sprint_response.data[0]
        stats = _get_or_create_user_stats(user_id)
        questions = _fetch_sprint_questions(sprint["id"])
        return {"sprint": sprint, "questions": questions, "user_stats": stats}

    document_response = (
        supabase_admin.table("documents")
        .select("id,status")
        .eq("user_id", user_id)
        .eq("status", "ready")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not document_response.data:
        raise ValueError("No ready documents available for daily sprint")

    document_id = document_response.data[0]["id"]
    target_concept_ids = _select_target_concepts(document_id, user_id)

    sprint_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()

    sprint_data = {
        "id": sprint_id,
        "user_id": user_id,
        "sprint_date": today,
        "document_id": document_id,
        "target_concepts": target_concept_ids or None,
        "num_questions": DEFAULT_NUM_QUESTIONS,
        "completed_questions": 0,
        "xp_earned": 0,
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }

    supabase_admin.table("daily_sprints").insert(sprint_data).execute()

    create_session(
        user_id=user_id,
        document_id=document_id,
        num_questions=DEFAULT_NUM_QUESTIONS,
        difficulty=DEFAULT_DIFFICULTY,
        question_types=DEFAULT_QUESTION_TYPES,
        focus_concept_ids=target_concept_ids or None,
        session_id=sprint_id,
    )

    stats = _get_or_create_user_stats(user_id)
    questions = _fetch_sprint_questions(sprint_id)

    return {"sprint": sprint_data, "questions": questions, "user_stats": stats}


def submit_sprint_answer(
    user_id: str,
    sprint_id: str,
    question_id: str,
    answer: str,
    input_method: str,
) -> dict:
    sprint_response = (
        supabase_admin.table("daily_sprints")
        .select("*")
        .eq("id", sprint_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not sprint_response.data:
        raise ValueError("Sprint not found")

    sprint = sprint_response.data[0]

    if sprint["status"] != "active":
        raise ValueError(f"Sprint is not active (status: {sprint['status']})")

    result = submit_answer(
        session_id=sprint_id,
        user_id=user_id,
        question_id=question_id,
        answer=answer,
        input_method=input_method,
    )

    is_correct = result["result"]["is_correct"]
    xp_delta = 10 if is_correct else 5
    new_completed = sprint["completed_questions"] + 1
    new_xp = sprint["xp_earned"] + xp_delta

    now = datetime.now(timezone.utc).isoformat()
    sprint_update = {
        "completed_questions": new_completed,
        "xp_earned": new_xp,
        "updated_at": now,
    }

    is_complete = new_completed >= sprint["num_questions"]
    if is_complete:
        sprint_update["status"] = "completed"

    supabase_admin.table("daily_sprints").update(sprint_update).eq(
        "id", sprint_id
    ).execute()

    if is_complete:
        stats = _get_or_create_user_stats(user_id)
        today = _utc_today_date_str()
        yesterday = _utc_yesterday_date_str()
        last_active = stats.get("last_active_date")

        streak_current = stats.get("streak_current", 0)
        if last_active == today:
            updated_streak_current = streak_current
        elif last_active == yesterday:
            updated_streak_current = streak_current + 1
        else:
            updated_streak_current = 1

        streak_best = max(stats.get("streak_best", 0), updated_streak_current)
        xp_total = stats.get("xp_total", 0) + new_xp

        stats_update = {
            "xp_total": xp_total,
            "streak_current": updated_streak_current,
            "streak_best": streak_best,
            "last_active_date": today,
            "updated_at": now,
        }

        supabase_admin.table("user_stats").update(stats_update).eq(
            "user_id", user_id
        ).execute()

    updated_sprint_response = (
        supabase_admin.table("daily_sprints").select("*").eq("id", sprint_id).execute()
    )
    updated_sprint = (
        updated_sprint_response.data[0] if updated_sprint_response.data else sprint
    )
    updated_stats = _get_or_create_user_stats(user_id)

    return {
        "sprint": updated_sprint,
        "result": result["result"],
        "user_stats": updated_stats,
    }
