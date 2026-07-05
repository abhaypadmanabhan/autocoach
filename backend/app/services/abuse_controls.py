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
