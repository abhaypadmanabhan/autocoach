from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException

from app.core.supabase import supabase_admin

# Limits
SPRINT_LIMIT = 1
QUIZ_LIMIT = 5
MAX_USAGE_UPDATE_RETRIES = 5


def _as_dict(value: object) -> dict:
    return value if isinstance(value, dict) else {}


def _get_today_str() -> str:
    """Return today's date as ISO string (YYYY-MM-DD)."""
    return datetime.now(timezone.utc).date().isoformat()


def get_or_create_daily_usage(user_id: str | UUID) -> dict:
    """Fetch current daily usage or create if missing."""
    today = _get_today_str()
    uid = str(user_id)

    # Try to fetch
    res = (
        supabase_admin.table("user_daily_usage")
        .select("*")
        .eq("user_id", uid)
        .eq("date", today)
        .maybe_single()
        .execute()
    )
    data = _as_dict(getattr(res, "data", None))
    if data:
        return data

    # Create new record
    new_usage = {
        "user_id": uid,
        "date": today,
        "sprints_used": 0,
        "quizzes_used": 0,
    }
    # Upsert to handle race conditions
    supabase_admin.table("user_daily_usage").upsert(
        new_usage, on_conflict="user_id, date"
    ).execute()

    created_res = (
        supabase_admin.table("user_daily_usage")
        .select("*")
        .eq("user_id", uid)
        .eq("date", today)
        .maybe_single()
        .execute()
    )

    return _as_dict(getattr(created_res, "data", None)) or new_usage


def is_pro(plan_type: str | None) -> bool:
    """Check if plan type is pro."""
    return (plan_type or "").lower().strip() == "pro"


def is_pro_user(user_id: str | UUID) -> bool:
    """Check if user has pro plan."""
    try:
        res = (
            supabase_admin.table("users")
            .select("plan_type")
            .eq("id", str(user_id))
            .single()
            .execute()
        )
        data = _as_dict(getattr(res, "data", None))
        return is_pro(data.get("plan_type"))
    except Exception:
        return False


def _build_limit_error(limit_type: str, limit: int, message: str) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail={
            "error": "daily_limit_reached",
            "type": limit_type,
            "limit": limit,
            "message": message,
        },
    )


def _consume_usage_or_raise(
    user_id: UUID,
    *,
    field: str,
    limit: int,
    limit_type: str,
    message: str,
) -> int:
    """Atomically increment usage with optimistic retry and limit enforcement."""
    # Pro users bypass limits and don't increment counters
    if is_pro_user(user_id):
        return 0

    today = _get_today_str()
    today = _get_today_str()
    uid = str(user_id)

    # Ensure row exists for compare-and-swap update path.
    supabase_admin.table("user_daily_usage").upsert(
        {
            "user_id": uid,
            "date": today,
            "sprints_used": 0,
            "quizzes_used": 0,
        },
        on_conflict="user_id, date",
    ).execute()

    for _ in range(MAX_USAGE_UPDATE_RETRIES):
        current_res = (
            supabase_admin.table("user_daily_usage")
            .select(field)
            .eq("user_id", uid)
            .eq("date", today)
            .single()
            .execute()
        )

        current_value = int(_as_dict(current_res.data).get(field, 0))
        if current_value >= limit:
            raise _build_limit_error(limit_type, limit, message)

        updated_res = (
            supabase_admin.table("user_daily_usage")
            .update(
                {
                    field: current_value + 1,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("user_id", uid)
            .eq("date", today)
            .eq(field, current_value)
            .execute()
        )

        if updated_res.data:
            return current_value + 1

    raise HTTPException(
        status_code=503,
        detail="Failed to update daily usage due to high contention. Please retry.",
    )


def check_sprint_limit(user_id: UUID) -> None:
    """Raise 429 if sprint limit reached."""
    usage = get_or_create_daily_usage(user_id)
    if usage["sprints_used"] >= SPRINT_LIMIT:
        raise _build_limit_error(
            "sprint",
            SPRINT_LIMIT,
            "You've reached your daily sprint limit.",
        )


def check_quiz_limit(user_id: UUID) -> None:
    """Raise 429 if quiz limit reached."""
    usage = get_or_create_daily_usage(user_id)
    if usage["quizzes_used"] >= QUIZ_LIMIT:
        raise _build_limit_error(
            "quiz",
            QUIZ_LIMIT,
            "You've reached your daily quiz limit.",
        )


def increment_sprint_usage(user_id: UUID) -> None:
    """Increment sprint usage count (atomic)."""
    _consume_usage_or_raise(
        user_id,
        field="sprints_used",
        limit=10**9,
        limit_type="sprint",
        message="You've reached your daily sprint limit.",
    )


def increment_quiz_usage(user_id: UUID) -> None:
    """Increment quiz usage count (atomic)."""
    _consume_usage_or_raise(
        user_id,
        field="quizzes_used",
        limit=10**9,
        limit_type="quiz",
        message="You've reached your daily quiz limit.",
    )


def consume_sprint_usage_or_429(user_id: UUID) -> int:
    """Atomically consume one sprint from daily quota or raise 429."""
    return _consume_usage_or_raise(
        user_id,
        field="sprints_used",
        limit=SPRINT_LIMIT,
        limit_type="sprint",
        message="You've reached your daily sprint limit.",
    )


def consume_quiz_usage_or_429(user_id: UUID) -> int:
    """Atomically consume one quiz from daily quota or raise 429."""
    return _consume_usage_or_raise(
        user_id,
        field="quizzes_used",
        limit=QUIZ_LIMIT,
        limit_type="quiz",
        message="You've reached your daily quiz limit.",
    )
