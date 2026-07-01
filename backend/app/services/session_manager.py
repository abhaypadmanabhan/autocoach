"""Quiz session management service — adaptive on-demand loop with async generation."""

import logging
import random
import time
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.config import get_settings
from app.core.supabase import supabase_admin
from app.observability.langfuse import observe
from app.services.quiz_generator import generate_single_question
from app.services.answer_evaluator import evaluate_answer
from app.models.quiz import QuestionType
from app.services.concepts import get_document_concepts, get_due_concepts

logger = logging.getLogger(__name__)


CORE_MASTERY_THRESHOLD = 80.0
DEPRIORITIZE_AFTER_CORRECT = 3  # consecutive corrects on a concept → skip it
RECENT_ASK_WINDOW = 3  # never re-pick a concept that appeared in the last N answered Qs
EXPLORATION_PROBABILITY = 0.30
MAX_GENERATION_ATTEMPTS = 2  # initial try + 1 retry inside the bg task


def _get_mastery_scores(user_id: str, concept_ids: list[str]) -> dict[str, float]:
    if not concept_ids:
        return {}

    response = (
        supabase_admin.table("user_concept_mastery")
        .select("concept_id,mastery_score")
        .eq("user_id", user_id)
        .in_("concept_id", concept_ids)
        .execute()
    )

    rows = response.data or []
    return {
        str(row.get("concept_id")): float(row.get("mastery_score") or 0.0)
        for row in rows
        if row.get("concept_id") is not None
    }


@observe(name="session.update_mastery", as_type="span")
def _update_concept_mastery(user_id: str, concept_ids: list[str], is_correct: bool):
    """Update mastery for a list of concepts (Bayesian-smoothed EMA blend)."""
    if not concept_ids:
        return

    now = datetime.now(timezone.utc).isoformat()

    for concept_id in concept_ids:
        try:
            res = (
                supabase_admin.table("user_concept_mastery")
                .select("*")
                .eq("user_id", user_id)
                .eq("concept_id", concept_id)
                .execute()
            )
            current = res.data[0] if res.data else None

            times_tested = (current["times_tested"] if current else 0) + 1
            times_correct = (current["times_correct"] if current else 0) + (
                1 if is_correct else 0
            )

            smoothed = (times_correct + 1) / (times_tested + 2)
            prev = (current["mastery_score"] / 100.0) if current else 0.0
            raw = 0.85 * prev + 0.15 * smoothed
            raw = max(0.0, min(1.0, raw))

            if times_tested < 5:
                display = min(raw, 0.95)
            elif times_tested >= 5 and smoothed >= 0.9:
                display = raw
            else:
                display = min(raw, 0.95)

            mastery_score = round(display * 100.0, 2)

            data = {
                "user_id": user_id,
                "concept_id": concept_id,
                "times_tested": times_tested,
                "times_correct": times_correct,
                "mastery_score": mastery_score,
                "last_tested_at": now,
            }

            if mastery_score >= CORE_MASTERY_THRESHOLD:
                if not current or not current.get("mastered_at"):
                    data["mastered_at"] = now
            else:
                data["mastered_at"] = None

            supabase_admin.table("user_concept_mastery").upsert(data).execute()
            logger.info(
                f"Updated mastery for concept {concept_id}: score={mastery_score}"
            )

        except Exception as e:
            logger.error(f"Failed to update mastery for concept {concept_id}: {e}")


def _recompute_document_progress(user_id: str, document_id: str):
    """Recompute documents.progress_core based on user's CORE concept mastery."""
    try:
        concepts = get_document_concepts(document_id, user_id)
        if not concepts:
            return

        core_concepts = [c for c in concepts if c["is_core"]]
        if not core_concepts:
            return

        mastered_count = sum(
            1 for c in core_concepts if c["mastery_score"] >= CORE_MASTERY_THRESHOLD
        )
        total_core = len(core_concepts)
        progress = round((mastered_count / total_core) * 100.0, 1)

        supabase_admin.table("documents").update({"progress_core": progress}).eq(
            "id", document_id
        ).execute()
        logger.info(
            f"Updated document {document_id} progress to {progress}% for user {user_id}"
        )

    except Exception as e:
        logger.error(f"Failed to recompute document progress: {e}")


def _recompute_session_counts(session_id: str) -> tuple[int, int]:
    try:
        questions_response = (
            supabase_admin.table("questions")
            .select("user_answer,is_correct")
            .eq("session_id", session_id)
            .execute()
        )
    except Exception as e:
        logger.error(f"Failed to fetch questions for session counts: {e}")
        return 0, 0

    questions = questions_response.data or []
    answered = sum(1 for q in questions if q.get("user_answer") is not None)
    correct = sum(1 for q in questions if q.get("is_correct") is True)
    return answered, correct


def _all_core_mastered(concepts: list[dict]) -> bool:
    """True when every core concept in the list has mastery >= threshold."""
    core = [c for c in concepts if c.get("is_core")]
    if not core:
        return False
    return all(c.get("mastery_score", 0.0) >= CORE_MASTERY_THRESHOLD for c in core)


def _get_session_question_history(session_id: str) -> list[dict]:
    """Return all answered questions for a session, oldest first."""
    res = (
        supabase_admin.table("questions")
        .select("id,concept_ids,is_correct,user_answer,answered_at,question_number")
        .eq("session_id", session_id)
        .not_.is_("user_answer", None)
        .order("question_number")
        .execute()
    )
    return res.data or []


def _due_concept_ids_for_document(user_id: str, document_id: str) -> set[str]:
    """Concept ids currently due for review within one document.

    Re-derived from get_due_concepts so the review pool narrows automatically
    as mastery rises (reviewed concepts leave the due set)."""
    try:
        due = get_due_concepts(user_id, limit=20)
    except Exception as e:
        logger.warning(f"[review] get_due_concepts failed for user {user_id}: {e}")
        return set()
    return {
        str(c["id"])
        for c in due
        if c.get("id") and str(c.get("document_id")) == str(document_id)
    }


def pick_review_document(user_id: str) -> tuple[str, list[str]] | None:
    """Auto-pick the document with the most due concepts.

    Tie-break: most recently studied (max last_tested_at among its due
    concepts). Skips documents not in 'ready' status / deleted. Returns
    (document_id, due_concept_ids) or None when nothing qualifies."""
    due = get_due_concepts(user_id, limit=20)
    if not due:
        return None

    by_doc: dict[str, dict] = {}
    for c in due:
        doc_id = c.get("document_id")
        cid = c.get("id")
        if not doc_id or not cid:
            continue
        entry = by_doc.setdefault(str(doc_id), {"ids": [], "latest": ""})
        entry["ids"].append(str(cid))
        last = c.get("last_tested_at") or ""
        if last > entry["latest"]:
            entry["latest"] = last
    if not by_doc:
        return None

    candidate_ids = list(by_doc.keys())
    docs_resp = (
        supabase_admin.table("documents")
        .select("id,status")
        .eq("user_id", user_id)
        .in_("id", candidate_ids)
        .eq("status", "ready")
        .execute()
    )
    ready_ids = {str(d["id"]) for d in (docs_resp.data or [])}
    ranked = [d for d in candidate_ids if d in ready_ids]
    if not ranked:
        return None

    # Most due first; tie-break by most recently studied.
    ranked.sort(key=lambda d: (len(by_doc[d]["ids"]), by_doc[d]["latest"]), reverse=True)
    chosen = ranked[0]
    return chosen, by_doc[chosen]["ids"]


def _select_next_concept(
    session_id: str, user_id: str, document_id: str, session_type: str = "standard"
) -> dict | None:
    """Pick the next concept to test, using updated mastery scores.

    Algorithm:
      1. Load CORE concepts with current user mastery.
      2. Skip concepts answered correctly 3 times in a row this session.
      3. Skip concepts asked in the last RECENT_ASK_WINDOW answered questions
         (prevents back-to-back-to-back picks).
      4. weight = max(1, (100 - mastery) * importance_score)
      5. With probability EXPLORATION_PROBABILITY: uniform-random over candidates.
         Otherwise: weighted sample by step 4 weights.
    """
    all_concepts = get_document_concepts(document_id, user_id)
    if not all_concepts:
        logger.warning(
            f"[selector] No concepts found for document {document_id}; cannot select"
        )
        return None

    if session_type == "review":
        due_ids = _due_concept_ids_for_document(user_id, document_id)
        core_concepts = [c for c in all_concepts if str(c["id"]) in due_ids]
        # Due subset exhausted (mastery rose) → fall back to normal core pool.
        if not core_concepts:
            core_concepts = [c for c in all_concepts if c.get("is_core")]
    else:
        core_concepts = [c for c in all_concepts if c.get("is_core")]

    if not core_concepts:
        logger.warning(
            f"[selector] No selectable concepts for document {document_id} "
            f"(session_type={session_type}); cannot select"
        )
        return None

    history = _get_session_question_history(session_id)

    # 3-correct-streak deprioritize: per concept, count trailing correct answers.
    # Walk backwards; once a concept hits a wrong answer, it's "frozen" and
    # earlier corrects do not count.
    trailing_correct: dict[str, int] = {}
    frozen: set[str] = set()
    for q in reversed(history):
        cids = q.get("concept_ids") or []
        for cid in cids:
            cid = str(cid)
            if cid in frozen:
                continue
            if q.get("is_correct") is True:
                trailing_correct[cid] = trailing_correct.get(cid, 0) + 1
            else:
                frozen.add(cid)
                trailing_correct.setdefault(cid, 0)

    skip_concepts = {
        cid for cid, n in trailing_correct.items() if n >= DEPRIORITIZE_AFTER_CORRECT
    }

    # Recent-asked dedup: concepts that appeared in the last RECENT_ASK_WINDOW
    # answered questions are excluded so the selector cannot pick the same
    # concept back-to-back-to-back. (Without this, a high-importance / low-mastery
    # concept can dominate a 10-Q session — observed via Langfuse 2026-05-09.)
    recent_asked: set[str] = set()
    for q in history[-RECENT_ASK_WINDOW:]:
        for cid in q.get("concept_ids") or []:
            recent_asked.add(str(cid))

    candidates = [
        c for c in core_concepts
        if str(c["id"]) not in skip_concepts and str(c["id"]) not in recent_asked
    ]
    # Tiny pool fallback: drop the recent-asked filter first (still respect the
    # 3-correct lockout); if that is also empty, fall back to the full core list
    # rather than dead-ending.
    if not candidates:
        candidates = [c for c in core_concepts if str(c["id"]) not in skip_concepts]
    if not candidates:
        candidates = core_concepts

    # Exploration roll: 30% uniform random, 70% weighted.
    if random.random() < EXPLORATION_PROBABILITY:
        choice = random.choice(candidates)
        logger.info(
            f"[selector] exploration roll → {choice.get('concept_name')} ({choice['id']})"
        )
        return choice

    weights: list[float] = []
    for c in candidates:
        mastery = float(c.get("mastery_score") or 0.0)
        importance = float(c.get("importance_score") or 0.0)
        # Floor importance at a tiny positive value so a misconfigured concept
        # is still selectable; floor weight at 1.0 so a fully-mastered concept
        # can still be selected via exploration in degenerate cases.
        weight = max(1.0, (100.0 - mastery) * max(importance, 0.1))
        weights.append(weight)

    chosen = random.choices(candidates, weights=weights, k=1)[0]
    logger.info(
        f"[selector] weighted pick → {chosen.get('concept_name')} ({chosen['id']}) "
        f"weights={[round(w, 2) for w in weights]}"
    )
    return chosen


def _build_question_response(question: dict, total_questions: int, difficulty: str) -> dict:
    return {
        "question_id": question["id"],
        "question_number": question["question_number"],
        "total_questions": total_questions,
        "question_type": question["question_type"],
        "question_text": question["question_text"],
        "options": question.get("options"),
        "difficulty": difficulty,
    }


def _generate_and_insert_question(
    session_id: str,
    document_id: str,
    user_id: str,
    difficulty: str,
    question_types: list[str],
    question_number: int,
    session_type: str = "standard",
) -> dict | None:
    """Synchronous: pick a concept, generate one question, insert as ready.

    Used for Q1 of a fresh session, where the caller must hand the first
    question back in the create-session response. Subsequent questions go
    through `generate_next_question_bg` instead.
    """
    concept = _select_next_concept(session_id, user_id, document_id, session_type)
    if not concept:
        return None

    q = generate_single_question(
        document_id=document_id,
        concept=concept,
        difficulty=difficulty,
        question_types=question_types,
    )
    if not q:
        logger.error(
            f"[session {session_id}] generator returned no question for concept "
            f"{concept.get('id')} ({concept.get('concept_name')})"
        )
        return None

    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": str(uuid4()),
        "session_id": session_id,
        "question_number": question_number,
        "question_type": q.get("question_type", "text_free"),
        "question_text": q.get("question_text", ""),
        "options": q.get("options"),
        "correct_answer": q.get("correct_answer", ""),
        "explanation": q.get("explanation"),
        "concept_ids": [str(concept["id"])],
        "user_answer": None,
        "is_correct": None,
        "input_method": None,
        "answered_at": None,
        "status": "ready",
        "ready_at": now,
        "generation_attempts": 1,
    }
    supabase_admin.table("questions").insert(record).execute()
    return record


# ---------------------------------------------------------------------------
# Async generation pipeline
# ---------------------------------------------------------------------------


def _has_active_generation(session_id: str) -> bool:
    """True if a question for this session is already ready or generating."""
    res = (
        supabase_admin.table("questions")
        .select("id,status")
        .eq("session_id", session_id)
        .in_("status", ["ready", "generating"])
        .limit(1)
        .execute()
    )
    return bool(res.data)


def _claim_generation_slot(session_id: str, question_number: int) -> str | None:
    """Insert a 'generating' placeholder row. Returns the row id, or None if
    another worker already owns this question slot for the session."""
    if _has_active_generation(session_id):
        return None

    row_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    placeholder = {
        "id": row_id,
        "session_id": session_id,
        "question_number": question_number,
        # NOT NULL columns must have placeholder values until the row is
        # filled in on the success path. They are never read while status
        # is 'generating'.
        "question_type": "text_free",
        "question_text": "",
        "correct_answer": "",
        "status": "generating",
        "generation_attempts": 0,
    }
    try:
        supabase_admin.table("questions").insert(placeholder).execute()
        return row_id
    except Exception as e:
        # Most likely a unique-violation if another worker raced us; treat
        # as "lost the race" and let the winner proceed.
        logger.warning(
            f"[session {session_id}] failed to claim generation slot (likely race): {e}"
        )
        return None


def _mark_generation_failed(question_id: str, attempts: int) -> None:
    supabase_admin.table("questions").update(
        {"status": "failed", "generation_attempts": attempts}
    ).eq("id", question_id).execute()


def _fill_ready_question(question_id: str, q: dict, concept_id: str, attempts: int) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    update = {
        "status": "ready",
        "question_type": q.get("question_type", "text_free"),
        "question_text": q.get("question_text", ""),
        "options": q.get("options"),
        "correct_answer": q.get("correct_answer", ""),
        "explanation": q.get("explanation"),
        "concept_ids": [concept_id],
        "ready_at": now,
        "generation_attempts": attempts,
    }
    res = (
        supabase_admin.table("questions")
        .update(update)
        .eq("id", question_id)
        .execute()
    )
    return (res.data[0] if res.data else {**update, "id": question_id})


def generate_next_question_bg(session_id: str, user_id: str) -> None:
    """Background-task entrypoint: claim a slot, run selector, call LLM,
    flip to 'ready'. Idempotent — exits quietly if another worker already
    owns generation for this session."""
    try:
        session_resp = (
            supabase_admin.table("quiz_sessions")
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not session_resp.data:
            logger.warning(f"[bg-gen {session_id}] session not found for user {user_id}")
            return
        session = session_resp.data[0]
        if session["status"] != "active":
            return  # Session ended between submit and bg-gen scheduling
    except Exception as e:
        logger.error(f"[bg-gen {session_id}] failed to fetch session: {e}")
        return

    answered, _ = _recompute_session_counts(session_id)
    if answered >= session["total_questions"]:
        return  # Cap reached — no more questions needed

    next_qnum = answered + 1
    placeholder_id = _claim_generation_slot(session_id, next_qnum)
    if placeholder_id is None:
        logger.info(
            f"[bg-gen {session_id}] question {next_qnum} already claimed elsewhere; skipping"
        )
        return

    document_id = session["document_id"]
    difficulty = session["difficulty"]
    question_types = ["text_mcq", "text_tf", "text_free"]

    attempts = 0
    last_err: Exception | None = None
    while attempts < MAX_GENERATION_ATTEMPTS:
        attempts += 1
        try:
            concept = _select_next_concept(
                session_id, user_id, document_id, session.get("session_type") or "standard"
            )
            if not concept:
                last_err = RuntimeError("selector returned no concept")
                break

            q = generate_single_question(
                document_id=document_id,
                concept=concept,
                difficulty=difficulty,
                question_types=question_types,
            )
            if not q:
                logger.warning(
                    f"[bg-gen {session_id}] attempt {attempts} returned no question; retrying"
                )
                continue

            _fill_ready_question(placeholder_id, q, str(concept["id"]), attempts)
            logger.info(
                f"[bg-gen {session_id}] q#{next_qnum} ready after {attempts} attempt(s)"
            )
            return
        except Exception as e:
            last_err = e
            logger.warning(f"[bg-gen {session_id}] attempt {attempts} raised: {e}")

    _mark_generation_failed(placeholder_id, attempts)
    logger.error(
        f"[bg-gen {session_id}] giving up after {attempts} attempts; last error: {last_err}"
    )


def _trigger_generation_if_needed(session_id: str, user_id: str) -> None:
    """Inline backstop used by GET /next when no row exists. Kicks off the
    bg task synchronously *enough* to claim a slot before we return 202."""
    # We deliberately do not await an LLM call here — `generate_next_question_bg`
    # is fire-and-forget for callers and idempotent on its own.
    try:
        generate_next_question_bg(session_id, user_id)
    except Exception as e:
        logger.error(f"[trigger-gen {session_id}] error: {e}")


def check_next_question(session_id: str, user_id: str) -> dict:
    """Single state probe used by the long-poll loop in GET /next.

    Returns one of:
      {"status":"ready", "question": {...}}
      {"status":"preparing"}
      {"status":"ended", "reason": "...", "summary": {...}}
      {"status":"failed", "error": "...", "message": "..."}
    """
    session_resp = (
        supabase_admin.table("quiz_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not session_resp.data:
        return {"status": "failed", "error": "session_not_found", "message": "Session not found."}
    session = session_resp.data[0]

    # Session already complete: serve the summary.
    if session["status"] != "active":
        score_pct = None
        if session["total_questions"] > 0:
            score_pct = round(
                (session["correct_answers"] / session["total_questions"]) * 100.0, 1
            )
        return {
            "status": "ended",
            "reason": session.get("ended_reason") or "cap_reached",
            "summary": {
                "total_answered": session["answered_questions"],
                "correct_answers": session["correct_answers"],
                "score_percentage": score_pct,
            },
        }

    # Look for ready / generating / failed row, lowest question_number first.
    rows = (
        supabase_admin.table("questions")
        .select("*")
        .eq("session_id", session_id)
        .in_("status", ["ready", "generating", "failed"])
        .order("question_number")
        .limit(1)
        .execute()
    )
    row = rows.data[0] if rows.data else None

    if row is None:
        # No row at all → backstop trigger. Caller will poll again.
        _trigger_generation_if_needed(session_id, user_id)
        return {"status": "preparing"}

    if row["status"] == "ready":
        return {
            "status": "ready",
            "question": _build_question_response(
                row, session["total_questions"], session["difficulty"]
            ),
        }

    if row["status"] == "failed":
        # Caller will see this; a fresh /next call (including frontend retry)
        # re-triggers generation by virtue of removing the failed row barrier.
        # We mark it answered-equivalent (i.e. drop it from the lookup window)
        # by leaving status=failed and instructing the caller via the response.
        return {
            "status": "failed",
            "error": "generator_unavailable",
            "message": "Could not generate the next question. Please retry.",
        }

    # status == 'generating' — check staleness.
    settings = get_settings()
    ttl = max(5, int(settings.generation_stale_ttl_seconds))
    created_at = row.get("created_at")
    is_stale = False
    if created_at:
        try:
            created_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            is_stale = (datetime.now(timezone.utc) - created_dt) > timedelta(seconds=ttl)
        except Exception:
            is_stale = False

    if is_stale:
        logger.warning(
            f"[next {session_id}] generating row {row['id']} stale (>{ttl}s); marking failed and re-triggering"
        )
        _mark_generation_failed(row["id"], (row.get("generation_attempts") or 0))
        _trigger_generation_if_needed(session_id, user_id)
        return {"status": "preparing"}

    # Still generating, within TTL — caller should wait.
    return {"status": "preparing"}


def create_session(
    user_id: str,
    document_id: str,
    num_questions: int,
    difficulty: str,
    question_types: list[str],
    focus_concept_ids: list[str] | None = None,
    session_id: str | None = None,
    session_type: str = "standard",
) -> dict:
    """Create a new adaptive quiz session and generate question 1.

    `num_questions` is now the maximum cap for the session. Subsequent
    questions are generated on demand in `submit_answer` based on updated
    mastery. The session ends when the user has answered `num_questions`
    OR every core concept reaches mastery >= 80.
    """
    try:
        all_concepts = get_document_concepts(document_id, user_id)
        concept_map = {str(c["id"]): c for c in all_concepts}

        # Validate focus concept ids if provided. Adaptive loop ignores them
        # for ongoing selection (mastery drives that), but a non-core focus
        # is still a sentinel that the caller wants a specific scope.
        if focus_concept_ids:
            for cid in focus_concept_ids:
                if cid not in concept_map:
                    raise ValueError(f"Concept ID {cid} not found in this document")

        if session_id is None:
            session_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()

        session_data = {
            "id": session_id,
            "user_id": user_id,
            "document_id": document_id,
            "status": "active",
            "session_type": session_type,
            "difficulty": difficulty,
            "total_questions": num_questions,
            "answered_questions": 0,
            "correct_answers": 0,
            "started_at": now,
            "completed_at": None,
        }
        supabase_admin.table("quiz_sessions").insert(session_data).execute()

        first_question = _generate_and_insert_question(
            session_id=session_id,
            document_id=document_id,
            user_id=user_id,
            difficulty=difficulty,
            question_types=question_types,
            question_number=1,
            session_type=session_type,
        )

        if not first_question:
            # Roll back session if we cannot produce a question.
            supabase_admin.table("quiz_sessions").delete().eq("id", session_id).execute()
            raise ValueError("Failed to generate the first question")

        logger.info(
            f"Created adaptive session {session_id} (cap={num_questions}); "
            f"Q1 ready"
        )

        return {
            "session_id": session_id,
            "document_id": document_id,
            "difficulty": difficulty,
            "total_questions": num_questions,
            "first_question": _build_question_response(
                first_question, num_questions, difficulty
            ),
        }

    except Exception as e:
        logger.error(f"Failed to create session: {e}")
        raise


def get_session(session_id: str, user_id: str) -> dict | None:
    """Return session status and all answered + currently-pending questions."""
    try:
        session_response = (
            supabase_admin.table("quiz_sessions")
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not session_response.data:
            logger.warning(f"Session {session_id} not found for user {user_id}")
            return None

        session = session_response.data[0]

        questions_response = (
            supabase_admin.table("questions")
            .select("*")
            .eq("session_id", session_id)
            .order("question_number")
            .execute()
        )
        questions = questions_response.data or []

        score_percentage = None
        if session["status"] == "completed" and session["total_questions"] > 0:
            score_percentage = round(
                (session["correct_answers"] / session["total_questions"]) * 100, 1
            )

        question_details = [
            {
                "question_id": q["id"],
                "question_number": q["question_number"],
                "question_type": q["question_type"],
                "question_text": q["question_text"],
                "user_answer": q["user_answer"],
                "is_correct": q["is_correct"],
                "correct_answer": q["correct_answer"],
                "explanation": q["explanation"],
            }
            for q in questions
        ]

        return {
            "session_id": session["id"],
            "document_id": session["document_id"],
            "status": session["status"],
            "difficulty": session["difficulty"],
            "total_questions": session["total_questions"],
            "answered_questions": session["answered_questions"],
            "correct_answers": session["correct_answers"],
            "score_percentage": score_percentage,
            "questions": question_details,
            "started_at": session["started_at"],
            "completed_at": session["completed_at"],
        }

    except Exception as e:
        logger.error(f"Failed to get session: {e}")
        return None


def get_current_question(session_id: str, user_id: str) -> dict | None:
    """Return the next unanswered question. Generates one on the fly if the
    session has none pending and is still under the cap (covers in-flight
    sessions created before the adaptive cutover)."""
    try:
        session_response = (
            supabase_admin.table("quiz_sessions")
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not session_response.data:
            logger.warning(f"Session {session_id} not found for user {user_id}")
            return None

        session = session_response.data[0]
        if session["status"] != "active":
            logger.info(
                f"Session {session_id} is not active (status: {session['status']})"
            )
            return None

        question_response = (
            supabase_admin.table("questions")
            .select("*")
            .eq("session_id", session_id)
            .eq("status", "ready")
            .order("question_number")
            .limit(1)
            .execute()
        )

        if question_response.data:
            question = question_response.data[0]
            return _build_question_response(
                question, session["total_questions"], session["difficulty"]
            )

        # No ready question — kick off async generation if cap not reached.
        answered, _ = _recompute_session_counts(session_id)
        if answered >= session["total_questions"]:
            return None

        # Returning None tells the caller "no current question right now".
        # Frontend uses GET /next for the long-poll path.
        _trigger_generation_if_needed(session_id, user_id)
        return None

    except Exception as e:
        logger.error(f"Failed to get current question: {e}")
        return None


def _finalize_answer(
    session: dict, user_id: str, question: dict, is_correct: bool, feedback: str
) -> dict:
    """Post-verdict bookkeeping shared by the inline (MCQ/T-F) and the async
    (text_free) eval paths: update mastery, recompute document progress and
    session counts, and decide whether the session ends.

    The caller is expected to have already written `is_correct` onto the
    question row. Returns the answer-result payload (without `eval_status`,
    which the caller stamps)."""
    session_id = session["id"]

    # 1. Update mastery BEFORE next-question selection so the bg generator
    #    sees fresh data.
    mastery_delta = 0.0
    try:
        q_concept_ids = question.get("concept_ids")
        if q_concept_ids:
            before_scores = _get_mastery_scores(user_id, q_concept_ids)
            _update_concept_mastery(user_id, q_concept_ids, is_correct)
            _recompute_document_progress(user_id, session["document_id"])
            after_scores = _get_mastery_scores(user_id, q_concept_ids)
            mastery_delta = round(
                sum(
                    after_scores.get(str(cid), 0.0)
                    - before_scores.get(str(cid), 0.0)
                    for cid in q_concept_ids
                ),
                2,
            )
    except Exception as e:
        logger.error(f"Failed to update mastery/progress: {e}")

    # 2. Refresh counts and decide whether to end the session.
    new_answered, new_correct = _recompute_session_counts(session_id)
    cap_hit = new_answered >= session["total_questions"]

    post_concepts = get_document_concepts(session["document_id"], user_id)
    all_mastered = _all_core_mastered(post_concepts)

    is_complete = cap_hit or all_mastered
    ended_reason = None
    if is_complete:
        ended_reason = "cap_reached" if cap_hit else "mastery_threshold"

    session_update = {
        "answered_questions": new_answered,
        "correct_answers": new_correct,
    }
    if is_complete:
        session_update["status"] = "completed"
        session_update["completed_at"] = datetime.now(timezone.utc).isoformat()

    try:
        supabase_admin.table("quiz_sessions").update(session_update).eq(
            "id", session_id
        ).execute()
    except Exception as e:
        logger.error(f"Failed to update quiz session counts: {e}")

    xp_awarded = 10 if is_correct else 0

    return {
        "result": {
            "is_correct": is_correct,
            "correct_answer": question["correct_answer"],
            "explanation": question["explanation"],
            "score_so_far": new_correct,
            "total_answered": new_answered,
            "feedback": feedback,
            "xp_awarded": xp_awarded,
            "mastery_delta": mastery_delta,
        },
        "session_complete": is_complete,
        "session_ended_reason": ended_reason,
    }


def submit_answer(
    session_id: str, user_id: str, question_id: str, answer: str, input_method: str
) -> dict:
    """Record an answer fast.

    MCQ / T-F are graded inline (pure string compare, ~sub-ms) and fully
    finalized here. `text_free` requires an LLM call (~2s p50), so it is
    recorded immediately with `is_correct = NULL` and `status = 'answered'`,
    and the verdict is produced off the request path by
    `evaluate_answer_bg` (scheduled by the route). The pending-eval marker is
    `status = 'answered' AND is_correct IS NULL` — no schema change needed.

    Does NOT generate the next question synchronously. For MCQ/T-F the route
    triggers `generate_next_question_bg`; for text_free `evaluate_answer_bg`
    triggers it once grading + mastery are settled. Returns a dict carrying
    `eval_status` ("complete" | "pending")."""
    try:
        session_response = (
            supabase_admin.table("quiz_sessions")
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not session_response.data:
            raise ValueError("Session not found")
        session = session_response.data[0]

        if session["status"] != "active":
            raise ValueError(f"Session is not active (status: {session['status']})")

        question_response = (
            supabase_admin.table("questions")
            .select("*")
            .eq("id", question_id)
            .eq("session_id", session_id)
            .execute()
        )
        if not question_response.data:
            raise ValueError("Question not found")
        question = question_response.data[0]

        if question["user_answer"] is not None:
            raise ValueError("Question already answered")

        now = datetime.now(timezone.utc).isoformat()
        is_async_eval = (
            str(question["question_type"]).lower() == QuestionType.TEXT_FREE.value
        )

        if is_async_eval:
            # Fast path: persist the answer, defer the LLM verdict. `answered_at`
            # doubles as the eval-start timestamp for the stale-TTL self-heal.
            supabase_admin.table("questions").update(
                {
                    "user_answer": answer,
                    "is_correct": None,
                    "input_method": input_method,
                    "answered_at": now,
                    "status": "answered",
                }
            ).eq("id", question_id).execute()

            # Counts for the immediate (pending) response. Do NOT finalize the
            # session here — `evaluate_answer_bg` owns mastery + completion once
            # the verdict lands.
            new_answered, new_correct = _recompute_session_counts(session_id)

            return {
                "result": {
                    "is_correct": None,
                    "correct_answer": question["correct_answer"],
                    "explanation": question["explanation"],
                    "score_so_far": new_correct,
                    "total_answered": new_answered,
                    "feedback": None,
                    "xp_awarded": 0,
                    "mastery_delta": 0.0,
                },
                "session_complete": False,
                "session_ended_reason": None,
                "eval_status": "pending",
            }

        # Inline path (MCQ / T-F): grade + finalize synchronously.
        eval_result = evaluate_answer(
            question_type=question["question_type"],
            user_answer=answer,
            correct_answer=question["correct_answer"],
            question_text=question["question_text"],
        )
        is_correct = eval_result["is_correct"]
        feedback = eval_result.get("feedback", "")

        supabase_admin.table("questions").update(
            {
                "user_answer": answer,
                "is_correct": is_correct,
                "input_method": input_method,
                "answered_at": now,
                "status": "answered",
            }
        ).eq("id", question_id).execute()

        finalized = _finalize_answer(session, user_id, question, is_correct, feedback)
        return {**finalized, "eval_status": "complete"}

    except Exception as e:
        logger.error(f"Failed to submit answer: {e}")
        raise


# ---------------------------------------------------------------------------
# Async free-text answer evaluation (mirrors the async generation FSM)
# ---------------------------------------------------------------------------


def evaluate_answer_bg(session_id: str, user_id: str, question_id: str) -> None:
    """Background-task entrypoint: grade a pending `text_free` answer, write
    the verdict onto the question row, finalize mastery + session state, then
    kick off next-question generation. Idempotent — exits quietly if the
    answer is missing or already graded (`is_correct` populated)."""
    try:
        session_resp = (
            supabase_admin.table("quiz_sessions")
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .execute()
        )
        if not session_resp.data:
            logger.warning(f"[bg-eval {session_id}] session not found for user {user_id}")
            return
        session = session_resp.data[0]

        question_resp = (
            supabase_admin.table("questions")
            .select("*")
            .eq("id", question_id)
            .eq("session_id", session_id)
            .execute()
        )
        if not question_resp.data:
            logger.warning(f"[bg-eval {session_id}] question {question_id} not found")
            return
        question = question_resp.data[0]

        if question.get("user_answer") is None:
            logger.warning(
                f"[bg-eval {session_id}] question {question_id} has no answer; skipping"
            )
            return
        if question.get("is_correct") is not None:
            # Already graded (another worker won the race, or a self-heal retry
            # arrived late) — nothing to do.
            return

        eval_result = evaluate_answer(
            question_type=question["question_type"],
            user_answer=question["user_answer"],
            correct_answer=question["correct_answer"],
            question_text=question["question_text"],
        )
        is_correct = bool(eval_result["is_correct"])
        feedback = eval_result.get("feedback", "")

        supabase_admin.table("questions").update({"is_correct": is_correct}).eq(
            "id", question_id
        ).execute()

        # Only the owner of the session-active state should finalize; if the
        # session already ended (edge: a concurrent path finished it) the
        # finalize is still safe/idempotent because it recomputes from rows.
        finalized = _finalize_answer(session, user_id, question, is_correct, feedback)

        logger.info(
            f"[bg-eval {session_id}] q {question_id} graded is_correct={is_correct}"
        )

        # Pre-warm the next question now that mastery is fresh.
        if not finalized["session_complete"]:
            generate_next_question_bg(session_id, user_id)

    except Exception as e:
        logger.error(f"[bg-eval {session_id}] failed to evaluate answer: {e}")


def _build_verdict_response(session: dict, question: dict) -> dict:
    """Assemble a completed answer verdict from a graded question row + the
    (now-finalized) session row. Used by the verdict long-poll."""
    is_correct = bool(question["is_correct"])
    session_complete = session["status"] != "active"
    ended_reason = None
    if session_complete:
        ended_reason = (
            "cap_reached"
            if session["answered_questions"] >= session["total_questions"]
            else "mastery_threshold"
        )
    return {
        "result": {
            "is_correct": is_correct,
            "correct_answer": question["correct_answer"],
            "explanation": question["explanation"],
            "score_so_far": session["correct_answers"],
            "total_answered": session["answered_questions"],
            "feedback": None,
            "xp_awarded": 10 if is_correct else 0,
            "mastery_delta": 0.0,
        },
        "session_complete": session_complete,
        "session_ended_reason": ended_reason,
        "eval_status": "complete",
    }


def check_answer_verdict(session_id: str, user_id: str, question_id: str) -> dict:
    """Single state probe for a `text_free` answer verdict.

    Returns `{"eval_status": "complete", ...}` once graded, or
    `{"eval_status": "pending", ...}` while the LLM eval is in flight. If the
    pending row is stale (older than the generation stale-TTL), re-drives
    `evaluate_answer_bg` to self-heal a dropped background task."""
    session_resp = (
        supabase_admin.table("quiz_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not session_resp.data:
        raise ValueError("Session not found")
    session = session_resp.data[0]

    question_resp = (
        supabase_admin.table("questions")
        .select("*")
        .eq("id", question_id)
        .eq("session_id", session_id)
        .execute()
    )
    if not question_resp.data:
        raise ValueError("Question not found")
    question = question_resp.data[0]

    if question.get("is_correct") is not None:
        return _build_verdict_response(session, question)

    pending = {
        "result": {
            "is_correct": None,
            "correct_answer": question["correct_answer"],
            "explanation": question["explanation"],
            "score_so_far": session["correct_answers"],
            "total_answered": session["answered_questions"],
            "feedback": None,
            "xp_awarded": 0,
            "mastery_delta": 0.0,
        },
        "session_complete": False,
        "session_ended_reason": None,
        "eval_status": "pending",
    }

    # Self-heal: if the answer has been sitting ungraded past the stale TTL,
    # the background task was likely lost — re-drive it inline (idempotent).
    settings = get_settings()
    ttl = max(5, int(settings.generation_stale_ttl_seconds))
    answered_at = question.get("answered_at")
    if answered_at:
        try:
            answered_dt = datetime.fromisoformat(answered_at.replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - answered_dt) > timedelta(seconds=ttl):
                logger.warning(
                    f"[verdict {session_id}] q {question_id} eval stale (>{ttl}s); "
                    f"re-driving evaluate_answer_bg"
                )
                evaluate_answer_bg(session_id, user_id, question_id)
        except Exception as e:
            logger.warning(f"[verdict {session_id}] stale-check failed: {e}")

    return pending


def wait_for_answer_verdict(
    session_id: str, user_id: str, question_id: str, wait_ms: int = 5000
) -> dict:
    """Long-poll wrapper around `check_answer_verdict`. Used by GET
    /quiz/sessions/{id}/answer to return the finished verdict for a
    `text_free` answer once background grading completes."""
    settings = get_settings()
    cap_ms = max(0, min(int(wait_ms), settings.next_question_max_wait_ms))
    deadline = time.monotonic() + (cap_ms / 1000.0)

    while True:
        result = check_answer_verdict(session_id, user_id, question_id)
        if result["eval_status"] == "complete":
            return result
        if time.monotonic() >= deadline:
            return {**result, "retry_after_ms": 500}
        time.sleep(0.2)


def wait_for_next_question(
    session_id: str, user_id: str, wait_ms: int = 5000
) -> dict:
    """Long-poll wrapper around `check_next_question`. Used by GET /next."""
    settings = get_settings()
    cap_ms = max(0, min(int(wait_ms), settings.next_question_max_wait_ms))
    deadline = time.monotonic() + (cap_ms / 1000.0)

    while True:
        result = check_next_question(session_id, user_id)
        if result["status"] in ("ready", "ended", "failed"):
            return result
        if time.monotonic() >= deadline:
            return {"status": "preparing", "retry_after_ms": 500}
        time.sleep(0.2)
