"""Quiz session management service — adaptive on-demand loop."""

import logging
import random
from datetime import datetime, timezone
from uuid import uuid4

from app.core.supabase import supabase_admin
from app.services.quiz_generator import generate_single_question
from app.services.answer_evaluator import evaluate_answer
from app.services.concepts import get_document_concepts

logger = logging.getLogger(__name__)


CORE_MASTERY_THRESHOLD = 80.0
MISS_STREAK_DECAY = 2  # weight x2 for next 2 selections after a wrong answer
DEPRIORITIZE_AFTER_CORRECT = 3  # consecutive corrects on a concept → skip it
EXPLORATION_PROBABILITY = 0.30


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


def _select_next_concept(
    session_id: str, user_id: str, document_id: str
) -> dict | None:
    """Pick the next concept to test, using updated mastery scores.

    Algorithm:
      1. Load CORE concepts with current user mastery.
      2. Skip concepts with the last 3 answers correct in this session.
      3. base weight = (100 - mastery) * importance_score
      4. If concept appeared in last 2 answered questions AND was wrong → weight × 2
      5. With probability EXPLORATION_PROBABILITY: uniform-random over core concepts.
         Otherwise: weighted sample by step 3-4 weights.
    """
    all_concepts = get_document_concepts(document_id, user_id)
    if not all_concepts:
        logger.warning(
            f"[selector] No concepts found for document {document_id}; cannot select"
        )
        return None

    core_concepts = [c for c in all_concepts if c.get("is_core")]
    if not core_concepts:
        logger.warning(
            f"[selector] No core concepts for document {document_id}; cannot select"
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

    # Miss-streak boost: concepts wrong in last MISS_STREAK_DECAY answered Qs.
    last_n = history[-MISS_STREAK_DECAY:] if history else []
    boosted: set[str] = set()
    for q in last_n:
        if q.get("is_correct") is False:
            for cid in q.get("concept_ids") or []:
                boosted.add(str(cid))

    candidates = [c for c in core_concepts if str(c["id"]) not in skip_concepts]
    # Edge case: if all core concepts are deprioritized, fall back to full core list.
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
        if str(c["id"]) in boosted:
            weight *= 2.0
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
) -> dict | None:
    """Pick a concept, generate one question, insert it, and return the row."""
    concept = _select_next_concept(session_id, user_id, document_id)
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
    }
    supabase_admin.table("questions").insert(record).execute()
    return record


def create_session(
    user_id: str,
    document_id: str,
    num_questions: int,
    difficulty: str,
    question_types: list[str],
    focus_concept_ids: list[str] | None = None,
    session_id: str | None = None,
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
            .is_("user_answer", None)
            .order("question_number")
            .limit(1)
            .execute()
        )

        if question_response.data:
            question = question_response.data[0]
            return _build_question_response(
                question, session["total_questions"], session["difficulty"]
            )

        # No pending question — generate one if cap not reached.
        answered, _ = _recompute_session_counts(session_id)
        if answered >= session["total_questions"]:
            return None

        new_q = _generate_and_insert_question(
            session_id=session_id,
            document_id=session["document_id"],
            user_id=user_id,
            difficulty=session["difficulty"],
            question_types=["text_mcq", "text_tf", "text_free"],
            question_number=answered + 1,
        )
        if not new_q:
            return None
        return _build_question_response(
            new_q, session["total_questions"], session["difficulty"]
        )

    except Exception as e:
        logger.error(f"Failed to get current question: {e}")
        return None


def submit_answer(
    session_id: str, user_id: str, question_id: str, answer: str, input_method: str
) -> dict:
    """Evaluate an answer, update mastery, then generate the next question
    on demand using the freshly-updated mastery scores. Ends the session
    when the cap is hit OR every core concept has reached mastery >= 80."""
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

        # 1. Evaluate
        eval_result = evaluate_answer(
            question_type=question["question_type"],
            user_answer=answer,
            correct_answer=question["correct_answer"],
            question_text=question["question_text"],
        )
        is_correct = eval_result["is_correct"]
        feedback = eval_result.get("feedback", "")

        now = datetime.now(timezone.utc).isoformat()
        supabase_admin.table("questions").update(
            {
                "user_answer": answer,
                "is_correct": is_correct,
                "input_method": input_method,
                "answered_at": now,
            }
        ).eq("id", question_id).execute()

        # 2. Update mastery FIRST so the next-concept selector sees fresh data.
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

        # 3. Refresh counts and decide whether to end the session.
        new_answered, new_correct = _recompute_session_counts(session_id)
        cap_hit = new_answered >= session["total_questions"]

        # Pull concepts AFTER mastery update to evaluate end-on-mastery.
        post_concepts = get_document_concepts(session["document_id"], user_id)
        all_mastered = _all_core_mastered(post_concepts)

        is_complete = cap_hit or all_mastered

        session_update = {
            "answered_questions": new_answered,
            "correct_answers": new_correct,
        }
        if is_complete:
            session_update["status"] = "completed"
            session_update["completed_at"] = now

        try:
            supabase_admin.table("quiz_sessions").update(session_update).eq(
                "id", session_id
            ).execute()
        except Exception as e:
            logger.error(f"Failed to update quiz session counts: {e}")

        # 4. Build next question — pre-generated if any remain (in-flight
        # sessions from before the cutover); otherwise generate on demand.
        next_question = None
        if not is_complete:
            pending = (
                supabase_admin.table("questions")
                .select("*")
                .eq("session_id", session_id)
                .is_("user_answer", None)
                .order("question_number")
                .limit(1)
                .execute()
            )
            if pending.data:
                next_question = _build_question_response(
                    pending.data[0],
                    session["total_questions"],
                    session["difficulty"],
                )
            else:
                generated = _generate_and_insert_question(
                    session_id=session_id,
                    document_id=session["document_id"],
                    user_id=user_id,
                    difficulty=session["difficulty"],
                    question_types=["text_mcq", "text_tf", "text_free"],
                    question_number=new_answered + 1,
                )
                if generated:
                    next_question = _build_question_response(
                        generated,
                        session["total_questions"],
                        session["difficulty"],
                    )
                else:
                    # Generator failure mid-session: end gracefully rather
                    # than handing the user a dead session.
                    logger.error(
                        f"[session {session_id}] no next question; ending session early"
                    )
                    is_complete = True
                    supabase_admin.table("quiz_sessions").update(
                        {"status": "completed", "completed_at": now}
                    ).eq("id", session_id).execute()

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
            "next_question": next_question,
            "session_complete": is_complete,
        }

    except Exception as e:
        logger.error(f"Failed to submit answer: {e}")
        raise
