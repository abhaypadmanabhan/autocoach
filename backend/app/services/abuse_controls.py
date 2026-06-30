from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException

from app.core.supabase import supabase_admin
from app.services.usage import has_unlimited


def enforce_max_documents(user_id: UUID, max_documents: int) -> None:
    if has_unlimited(user_id):
        return

    response = (
        supabase_admin.table("documents")
        .select("id")
        .eq("user_id", str(user_id))
        .execute()
    )
    existing_count = len(response.data or [])

    if existing_count >= max_documents:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Document limit reached ({max_documents}). "
                "Please delete a document or upgrade your plan."
            ),
        )


def _get_today_window() -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    return start.isoformat(), end.isoformat()


def enforce_daily_quiz_sessions(user_id: UUID, max_sessions_per_day: int) -> None:
    start, end = _get_today_window()
    response = (
        supabase_admin.table("quiz_sessions")
        .select("id")
        .eq("user_id", str(user_id))
        .gte("created_at", start)
        .lt("created_at", end)
        .execute()
    )

    existing_count = len(response.data or [])

    if existing_count >= max_sessions_per_day:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Daily quiz session limit reached ({max_sessions_per_day}). "
                "Please try again tomorrow or upgrade your plan."
            ),
        )
