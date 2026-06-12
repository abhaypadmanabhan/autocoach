"""Admin script to delete all data associated with a user for GDPR compliance.

Runnable as:
    python -m scripts.delete_user <user_id_or_email> [--dry-run]
"""

import argparse
import logging
import os
import sys
from uuid import UUID

# Ensure backend root is in python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("delete_user")

# Import backend dependencies
from app.core.supabase import supabase_admin
from app.core.qdrant import qdrant_client, DEFAULT_COLLECTION_NAME, delete_document_vectors
from qdrant_client.models import Filter, FieldCondition, MatchValue


def resolve_user(user_id_or_email: str) -> tuple[str | None, str | None]:
    """Resolve user ID and email from input string.

    Checks UUID format, public users table, and Supabase Auth Admin list.
    Returns (user_id, user_email).
    """
    user_id = None
    user_email = None

    # 1. Parse as UUID directly
    try:
        user_id = str(UUID(user_id_or_email))
    except ValueError:
        pass

    # 2. Look up in public users table
    if user_id:
        try:
            res = supabase_admin.table("users").select("id, email").eq("id", user_id).execute()
            if res.data:
                user_email = res.data[0].get("email")
                return user_id, user_email
        except Exception as e:
            logger.warning(f"Error querying public users table by ID: {e}")
    else:
        try:
            res = supabase_admin.table("users").select("id, email").eq("email", user_id_or_email).execute()
            if res.data:
                user_id = res.data[0]["id"]
                user_email = res.data[0].get("email")
                return user_id, user_email
        except Exception as e:
            logger.warning(f"Error querying public users table by email: {e}")

    # 3. Query Auth Admin list fallback
    try:
        auth_users = supabase_admin.auth.admin.list_users()
        users_list = getattr(auth_users, "users", auth_users)
        if not isinstance(users_list, list):
            users_list = []

        for u in users_list:
            if u.id == user_id_or_email or u.email == user_id_or_email:
                return u.id, u.email
    except Exception as e:
        logger.warning(f"Error listing auth users: {e}")

    # 4. If we parsed a UUID but couldn't find a record, still return it
    if user_id:
        return user_id, None

    return None, None


def main():
    parser = argparse.ArgumentParser(description="Delete all user data (GDPR cleanup)")
    parser.add_argument("user_id_or_email", help="The UUID or email of the user to delete")
    parser.add_argument("--dry-run", action="store_true", help="Print counts without deleting")
    args = parser.parse_args()

    target = args.user_id_or_email
    dry_run = args.dry_run

    user_id, user_email = resolve_user(target)

    if not user_id:
        logger.error(f"Could not resolve user from target: {target}")
        sys.exit(1)

    logger.info(f"Target Resolved: user_id={user_id}, email={user_email or 'Unknown'}")

    # --- Collect database objects to delete ---
    # documents
    docs_res = supabase_admin.table("documents").select("id, file_path").eq("user_id", user_id).execute()
    docs = docs_res.data or []
    doc_ids = [d["id"] for d in docs]
    db_file_paths = [d["file_path"] for d in docs if d.get("file_path")]

    # chunks
    chunks = []
    if doc_ids:
        chunks_res = supabase_admin.table("chunks").select("id").in_("document_id", doc_ids).execute()
        chunks = chunks_res.data or []

    # quiz_sessions
    sessions_res = supabase_admin.table("quiz_sessions").select("id").eq("user_id", user_id).execute()
    sessions = sessions_res.data or []
    session_ids = [s["id"] for s in sessions]

    # questions
    questions = []
    if session_ids:
        questions_res = supabase_admin.table("questions").select("id").in_("session_id", session_ids).execute()
        questions = questions_res.data or []

    # user_concept_mastery
    mastery_res = supabase_admin.table("user_concept_mastery").select("id").eq("user_id", user_id).execute()
    mastery = mastery_res.data or []

    # user_daily_usage
    usage_res = supabase_admin.table("user_daily_usage").select("user_id").eq("user_id", user_id).execute()
    usage = usage_res.data or []

    # user_onboarding
    onboarding_res = supabase_admin.table("user_onboarding").select("user_id").eq("user_id", user_id).execute()
    onboarding = onboarding_res.data or []

    # user_xp
    xp_rows = []
    try:
        xp_res = supabase_admin.table("user_xp").select("user_id").eq("user_id", user_id).execute()
        xp_rows = xp_res.data or []
    except Exception:
        pass

    # user_documents_progress
    progress_rows = []
    try:
        progress_res = supabase_admin.table("user_documents_progress").select("user_id").eq("user_id", user_id).execute()
        progress_rows = progress_res.data or []
    except Exception:
        pass

    # public.users
    public_users_res = supabase_admin.table("users").select("id").eq("id", user_id).execute()
    public_users = public_users_res.data or []

    # --- Collect Storage objects ---
    storage_files = []
    try:
        folders = supabase_admin.storage.from_("documents").list(path=str(user_id))
        for f in (folders or []):
            name = f.get("name")
            if not name:
                continue
            if f.get("id") is not None:
                # Top level file
                storage_files.append(f"{user_id}/{name}")
            else:
                # Subdirectory
                sub_path = f"{user_id}/{name}"
                sub_items = supabase_admin.storage.from_("documents").list(path=sub_path)
                for item in (sub_items or []):
                    item_name = item.get("name")
                    if item_name and item_name != ".emptyFolderPlaceholder":
                        storage_files.append(f"{sub_path}/{item_name}")
    except Exception as e:
        logger.warning(f"Failed to list Supabase Storage: {e}")

    # Fallback to database file paths
    for path in db_file_paths:
        if path not in storage_files:
            storage_files.append(path)

    # --- Count Qdrant Vectors ---
    qdrant_vector_count = 0
    if doc_ids:
        for doc_id in doc_ids:
            try:
                count_res = qdrant_client.count(
                    collection_name=DEFAULT_COLLECTION_NAME,
                    count_filter=Filter(
                        must=[
                            FieldCondition(
                                key="document_id",
                                match=MatchValue(value=doc_id)
                            )
                        ]
                    )
                )
                qdrant_vector_count += count_res.count
            except Exception as e:
                logger.warning(f"Failed to count Qdrant vectors for doc {doc_id}: {e}")

    # --- Print Summary / Execute Deletion ---
    if dry_run:
        print("=" * 60)
        print(f"DRY RUN SUMMARY: USER DATA DELETION FOR {target}")
        print(f"Resolved User ID: {user_id}")
        print(f"Resolved User Email: {user_email or 'Unknown'}")
        print("-" * 60)
        print(f"Table 'documents': {len(docs)} row(s)")
        print(f"Table 'chunks': {len(chunks)} row(s)")
        print(f"Table 'questions': {len(questions)} row(s)")
        print(f"Table 'quiz_sessions': {len(sessions)} row(s)")
        print(f"Table 'user_concept_mastery': {len(mastery)} row(s)")
        print(f"Table 'user_daily_usage': {len(usage)} row(s)")
        print(f"Table 'user_onboarding': {len(onboarding)} row(s)")
        print(f"Table 'user_xp' (best-effort): {len(xp_rows)} row(s)")
        print(f"Table 'user_documents_progress' (best-effort): {len(progress_rows)} row(s)")
        print(f"Table 'users' (public schema): {len(public_users)} row(s)")
        print(f"Supabase Storage 'documents' bucket: {len(storage_files)} file(s)")
        print(f"Qdrant Vectors: {qdrant_vector_count} point(s)")
        print(f"Auth User: {user_id} would be deleted last")
        print("=" * 60)
        print("Dry run completed. No data was modified.")
    else:
        logger.info(f"Starting actual deletion for user {user_id} ({user_email or 'Unknown'})...")

        # 1. Delete Qdrant vectors
        if doc_ids:
            logger.info(f"Deleting Qdrant vectors for {len(doc_ids)} documents...")
            for doc_id in doc_ids:
                try:
                    delete_document_vectors(doc_id)
                except Exception as e:
                    logger.error(f"Failed to delete Qdrant vectors for doc {doc_id}: {e}")

        # 2. Delete storage files
        if storage_files:
            logger.info(f"Deleting {len(storage_files)} file(s) from Supabase Storage...")
            try:
                supabase_admin.storage.from_("documents").remove(storage_files)
            except Exception as e:
                logger.error(f"Failed to delete files from Supabase Storage: {e}")

        # 3. Delete database rows (dependency order)
        # - questions
        if session_ids:
            logger.info(f"Deleting {len(questions)} row(s) from 'questions'...")
            try:
                supabase_admin.table("questions").delete().in_("session_id", session_ids).execute()
            except Exception as e:
                logger.error(f"Failed to delete questions: {e}")

        # - quiz_sessions
        logger.info(f"Deleting {len(sessions)} row(s) from 'quiz_sessions'...")
        try:
            supabase_admin.table("quiz_sessions").delete().eq("user_id", user_id).execute()
        except Exception as e:
            logger.error(f"Failed to delete quiz_sessions: {e}")

        # - chunks
        if doc_ids:
            logger.info(f"Deleting {len(chunks)} row(s) from 'chunks'...")
            try:
                supabase_admin.table("chunks").delete().in_("document_id", doc_ids).execute()
            except Exception as e:
                logger.error(f"Failed to delete chunks: {e}")

        # - documents
        logger.info(f"Deleting {len(docs)} row(s) from 'documents'...")
        try:
            supabase_admin.table("documents").delete().eq("user_id", user_id).execute()
        except Exception as e:
            logger.error(f"Failed to delete documents: {e}")

        # - user_concept_mastery
        logger.info(f"Deleting {len(mastery)} row(s) from 'user_concept_mastery'...")
        try:
            supabase_admin.table("user_concept_mastery").delete().eq("user_id", user_id).execute()
        except Exception as e:
            logger.error(f"Failed to delete user_concept_mastery: {e}")

        # - user_daily_usage
        logger.info(f"Deleting {len(usage)} row(s) from 'user_daily_usage'...")
        try:
            supabase_admin.table("user_daily_usage").delete().eq("user_id", user_id).execute()
        except Exception as e:
            logger.error(f"Failed to delete user_daily_usage: {e}")

        # - user_onboarding
        logger.info(f"Deleting {len(onboarding)} row(s) from 'user_onboarding'...")
        try:
            supabase_admin.table("user_onboarding").delete().eq("user_id", user_id).execute()
        except Exception as e:
            logger.error(f"Failed to delete user_onboarding: {e}")

        # - user_xp (optional/best effort)
        try:
            logger.info("Deleting from 'user_xp'...")
            supabase_admin.table("user_xp").delete().eq("user_id", user_id).execute()
        except Exception as e:
            logger.info(f"Note: skipped 'user_xp' deletion (table may not exist): {e}")

        # - user_documents_progress (optional/best effort)
        try:
            logger.info("Deleting from 'user_documents_progress'...")
            supabase_admin.table("user_documents_progress").delete().eq("user_id", user_id).execute()
        except Exception as e:
            logger.info(f"Note: skipped 'user_documents_progress' deletion (table may not exist): {e}")

        # - users (public schema)
        logger.info("Deleting from 'users' public table...")
        try:
            supabase_admin.table("users").delete().eq("id", user_id).execute()
        except Exception as e:
            logger.error(f"Failed to delete public users table row: {e}")

        # 4. Delete auth user last
        logger.info(f"Deleting auth user {user_id} via admin API...")
        try:
            supabase_admin.auth.admin.delete_user(user_id)
        except Exception as e:
            logger.error(f"Failed to delete auth user {user_id}: {e}")

        logger.info("Deletion completed successfully!")


if __name__ == "__main__":
    main()
