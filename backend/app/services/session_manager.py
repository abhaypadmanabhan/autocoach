"""Quiz session management service."""

import logging
from datetime import datetime, timezone
from uuid import uuid4

from app.core.supabase import supabase_admin
from app.services.quiz_generator import generate_quiz_questions
from app.services.answer_evaluator import evaluate_answer
from app.services.concepts import get_document_concepts

logger = logging.getLogger(__name__)


def _update_concept_mastery(user_id: str, concept_ids: list[str], is_correct: bool):
    """
    Update mastery for a list of concepts.
    """
    if not concept_ids:
        return

    now = datetime.now(timezone.utc).isoformat()

    for concept_id in concept_ids:
        try:
            # Get current mastery
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

            # Simple MVP formula: (correct / tested) * 100
            mastery_score = round((times_correct / times_tested) * 100.0, 2)
            mastery_score = min(100.0, max(0.0, mastery_score))

            data = {
                "user_id": user_id,
                "concept_id": concept_id,
                "times_tested": times_tested,
                "times_correct": times_correct,
                "mastery_score": mastery_score,
                "last_tested_at": now,
            }

            # Check if mastered (>= 80)
            if mastery_score >= 80.0:
                # If newly mastered or mastered_at was null
                if not current or not current.get("mastered_at"):
                    data["mastered_at"] = now

            supabase_admin.table("user_concept_mastery").upsert(data).execute()
            logger.info(
                f"Updated mastery for concept {concept_id}: score={mastery_score}"
            )

        except Exception as e:
            logger.error(f"Failed to update mastery for concept {concept_id}: {e}")


def _recompute_document_progress(user_id: str, document_id: str):
    """
    Recompute document completion progress based on CORE concepts.
    MVP: Store in documents.progress_core (shared field, but treated as per-user).
    """
    try:
        # Get all concepts for doc
        concepts = get_document_concepts(document_id, user_id)
        if not concepts:
            return

        # Filter for CORE concepts (importance >= 0.6)
        core_concepts = [c for c in concepts if c["importance_score"] >= 0.6]

        if not core_concepts:
            # No core concepts defined yet, can't compute core progress
            return

        # Count mastered core concepts
        mastered_count = sum(1 for c in core_concepts if c["mastery_score"] >= 80.0)
        total_core = len(core_concepts)

        progress = round((mastered_count / total_core) * 100.0, 1)

        # Update document
        # NOTE: destructive to other users' progress views if this field is shared.
        # Per requirements: "Store progress_core into documents.progress_core... Use documents.progress_core for now"
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


def create_session(
    user_id: str,
    document_id: str,
    num_questions: int,
    difficulty: str,
    question_types: list[str],
    focus_concept_ids: list[str] | None = None,
    session_id: str | None = None,
) -> dict:
    """
    Create a new quiz session.

    Args:
        user_id: The user's ID.
        document_id: The document ID.
        num_questions: Number of questions to generate.
        difficulty: Difficulty level.
        question_types: Types of questions to include.
        focus_concept_ids: Optional specific concepts to target.

    Returns:
        Dictionary with session data and first question.
    """
    try:
        # 1. Determine Target Concepts
        target_concepts_list = []  # List of dicts {name, description}

        # Fetch all doc concepts first (we need them for validation or auto-selection)
        all_concepts = get_document_concepts(document_id, user_id)
        concept_map = {str(c["id"]): c for c in all_concepts}

        if focus_concept_ids:
            # User requested specific focus
            for cid in focus_concept_ids:
                if cid in concept_map:
                    # Validate importance >= 0.6 unless doc is complete
                    # (Simplified: just check score for now as per "unless document core is complete (progress_core >= 100)")
                    # We need to check document progress. For MVP speed, let's just check importance for now or fetch doc.
                    # Per req: "Validate: only allow concepts with importance_score >= 0.6 unless document core is complete"
                    # I'll enable it for now to be safe, but ideally we check document.progress_core
                    c = concept_map[cid]
                    if c["importance_score"] < 0.6:
                        # Check doc status
                        # Per requirement: "If document.progress_core is stored per-user incorrectly, treat it as unknown and allow only core concepts"
                        # So unless we are SURE it is 100, we block.
                        # Query doc again to get progress_core
                        doc_res = (
                            supabase_admin.table("documents")
                            .select("progress_core")
                            .eq("id", document_id)
                            .execute()
                        )
                        prog = (
                            doc_res.data[0].get("progress_core") if doc_res.data else 0
                        )

                        # "unless document core is complete (progress_core >= 100)"
                        if (prog or 0) < 100:
                            raise ValueError(
                                f"Concept '{c['concept_name']}' is not core (importance < 0.6). Finish core concepts first (current progress: {prog or 0}%)."
                            )

                    target_concepts_list.append(
                        {
                            "name": c["concept_name"],
                            "description": c.get("concept_description", ""),
                        }
                    )
                else:
                    raise ValueError(f"Concept ID {cid} not found in this document")

            logger.info(
                f"Targeting requested concepts: {[c['name'] for c in target_concepts_list]}"
            )

        else:
            # Auto-selection: 3 weak core concepts
            # Filter: importance >= 0.6 AND mastery < 80
            candidates = [
                c
                for c in all_concepts
                if c["importance_score"] >= 0.6 and c["mastery_score"] < 80.0
            ]
            # Sort: Importance DESC, then Mastery ASC (lowest mastery first) - wait, python sort is stable
            # Sort by mastery ASC first
            candidates.sort(key=lambda x: x["mastery_score"])
            # Then by importance DESC
            candidates.sort(key=lambda x: x["importance_score"], reverse=True)

            # Take top 3
            selected_candidates = candidates[:3]
            target_concepts_list = [
                {
                    "name": c["concept_name"],
                    "description": c.get("concept_description", ""),
                }
                for c in selected_candidates
            ]
            logger.info(
                f"Auto-selected target concepts: {[c['name'] for c in target_concepts_list]}"
            )

        # Target Concept IDs are derived from the same source, but we need to map names back if we want to
        # (Actually we just used the IDs to get the names, so we can reconstruct or just use focus_ids if present.
        # But for Auto-selected, we need the IDs to save to the question record.)
        # Let's map names back to IDs from the candidate list for exact matching
        target_concept_ids = []
        if focus_concept_ids:
            target_concept_ids = focus_concept_ids
        else:
            # Map names back to IDs (safe because names should be unique enough within doc, or just use the candidate objects directly)
            # Actually we computed `selected_candidates` above, so we can just grab IDs from there.
            if "selected_candidates" in locals():
                target_concept_ids = [str(c["id"]) for c in selected_candidates]

        # Generate quiz questions
        questions = generate_quiz_questions(
            document_id=document_id,
            num_questions=num_questions,
            difficulty=difficulty,
            question_types=question_types,
            target_concepts=target_concepts_list,
        )

        if not questions:
            logger.error("Failed to generate quiz questions")
            raise ValueError("Failed to generate quiz questions")

        # Create session record
        if session_id is None:
            session_id = str(uuid4())
        now = datetime.now(timezone.utc).isoformat()

        session_data = {
            "id": session_id,
            "user_id": user_id,
            "document_id": document_id,
            "status": "active",
            "difficulty": difficulty,
            "total_questions": len(questions),
            "answered_questions": 0,
            "correct_answers": 0,
            "started_at": now,
            "completed_at": None,
        }

        supabase_admin.table("quiz_sessions").insert(session_data).execute()

        # Create question records
        question_records = []
        for i, q in enumerate(questions, 1):
            # Assign first 1-2 target concepts if available
            q_concept_ids = target_concept_ids[:2] if target_concept_ids else None

            question_record = {
                "id": str(uuid4()),
                "session_id": session_id,
                "question_number": i,
                "question_type": q.get("question_type", "unknown"),
                "question_text": q.get("question_text", ""),
                "options": q.get("options"),
                "correct_answer": q.get("correct_answer", ""),
                "explanation": q.get("explanation"),
                "concept_ids": q_concept_ids,
                "user_answer": None,
                "is_correct": None,
                "input_method": None,
                "answered_at": None,
            }
            question_records.append(question_record)

        # Insert questions in batches
        for i in range(0, len(question_records), 100):
            batch = question_records[i : i + 100]
            supabase_admin.table("questions").insert(batch).execute()

        # Get first question
        first_question = question_records[0] if question_records else None

        logger.info(f"Created session {session_id} with {len(questions)} questions")

        return {
            "session_id": session_id,
            "document_id": document_id,
            "difficulty": difficulty,
            "total_questions": len(questions),
            "first_question": {
                "question_id": first_question["id"],
                "question_number": first_question["question_number"],
                "total_questions": len(questions),
                "question_type": first_question["question_type"],
                "question_text": first_question["question_text"],
                "options": first_question["options"],
                "difficulty": difficulty,
            }
            if first_question
            else None,
        }

    except Exception as e:
        logger.error(f"Failed to create session: {e}")
        raise


def get_session(session_id: str, user_id: str) -> dict | None:
    """
    Get session status and all questions.

    Args:
        session_id: The session ID.
        user_id: The user's ID (for verification).

    Returns:
        Session status dictionary or None if not found/unauthorized.
    """
    try:
        # Fetch session
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

        # Fetch all questions
        questions_response = (
            supabase_admin.table("questions")
            .select("*")
            .eq("session_id", session_id)
            .order("question_number")
            .execute()
        )

        questions = questions_response.data or []

        # Calculate score percentage
        score_percentage = None
        if session["status"] == "completed" and session["total_questions"] > 0:
            score_percentage = round(
                (session["correct_answers"] / session["total_questions"]) * 100, 1
            )

        # Build question details
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
    """
    Get the next unanswered question in a session.

    Args:
        session_id: The session ID.
        user_id: The user's ID (for verification).

    Returns:
        Question data or None if all answered/session complete.
    """
    try:
        # Verify session exists and belongs to user
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

        # Get first unanswered question
        question_response = (
            supabase_admin.table("questions")
            .select("*")
            .eq("session_id", session_id)
            .is_("user_answer", None)
            .order("question_number")
            .limit(1)
            .execute()
        )

        if not question_response.data:
            return None

        question = question_response.data[0]

        return {
            "question_id": question["id"],
            "question_number": question["question_number"],
            "total_questions": session["total_questions"],
            "question_type": question["question_type"],
            "question_text": question["question_text"],
            "options": question["options"],
            "difficulty": session["difficulty"],
        }

    except Exception as e:
        logger.error(f"Failed to get current question: {e}")
        return None


def submit_answer(
    session_id: str, user_id: str, question_id: str, answer: str, input_method: str
) -> dict:
    """
    Submit an answer for a question in a session.

    Args:
        session_id: The session ID.
        user_id: The user's ID (for verification).
        question_id: The question ID.
        answer: The user's answer.
        input_method: How the answer was input (click/text).

    Returns:
        Dictionary with result and next question (if any).
    """
    try:
        # Verify session exists and belongs to user
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

        # Fetch the question
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

        # Check if already answered
        if question["user_answer"] is not None:
            raise ValueError("Question already answered")

        # Evaluate the answer
        eval_result = evaluate_answer(
            question_type=question["question_type"],
            user_answer=answer,
            correct_answer=question["correct_answer"],
            question_text=question["question_text"],
        )

        is_correct = eval_result["is_correct"]
        feedback = eval_result.get("feedback", "")

        # Update question record
        now = datetime.now(timezone.utc).isoformat()
        supabase_admin.table("questions").update(
            {
                "user_answer": answer,
                "is_correct": is_correct,
                "input_method": input_method,
                "answered_at": now,
            }
        ).eq("id", question_id).execute()

        # Update session counts from source of truth
        new_answered, new_correct = _recompute_session_counts(session_id)

        session_update = {
            "answered_questions": new_answered,
            "correct_answers": new_correct,
        }

        # Check if all questions answered
        is_complete = new_answered >= session["total_questions"]
        if is_complete:
            session_update["status"] = "completed"
            session_update["completed_at"] = now

        try:
            supabase_admin.table("quiz_sessions").update(session_update).eq(
                "id", session_id
            ).execute()
        except Exception as e:
            logger.error(f"Failed to update quiz session counts: {e}")

        # Update Concept Mastery & Document Progress
        try:
            q_concept_ids = question.get("concept_ids")
            if q_concept_ids:
                # Update specific concept mastery
                background_tasks = None  # Ideally this should be background, but existing function is sync and called from sync route wrapper
                # We'll run it synchronously for safety/simplicity as requested ("safe defaults")
                _update_concept_mastery(user_id, q_concept_ids, is_correct)

                # Recompute doc progress
                _recompute_document_progress(user_id, session["document_id"])

                # Log mastery update details
                # Fetch updated progress for logging
                prog_res = (
                    supabase_admin.table("documents")
                    .select("progress_core")
                    .eq("id", session["document_id"])
                    .execute()
                )
                current_prog = (
                    prog_res.data[0].get("progress_core")
                    if prog_res.data
                    else "unknown"
                )

                logger.info(
                    f"Mastery Update | Session: {session_id} | Question: {question_id} | "
                    f"Concepts: {q_concept_ids} | Correct: {is_correct} | "
                    f"DocCoreProgress: {current_prog}"
                )
        except Exception as e:
            logger.error(f"Failed to update mastery/progress: {e}")
            # Don't fail the request, this is side-effect data

        # Get next question if not complete
        next_question = None
        if not is_complete:
            next_q_response = (
                supabase_admin.table("questions")
                .select("*")
                .eq("session_id", session_id)
                .is_("user_answer", None)
                .order("question_number")
                .limit(1)
                .execute()
            )

            if next_q_response.data:
                next_q = next_q_response.data[0]
                next_question = {
                    "question_id": next_q["id"],
                    "question_number": next_q["question_number"],
                    "total_questions": session["total_questions"],
                    "question_type": next_q["question_type"],
                    "question_text": next_q["question_text"],
                    "options": next_q["options"],
                    "difficulty": session["difficulty"],
                }

        return {
            "result": {
                "is_correct": is_correct,
                "correct_answer": question["correct_answer"],
                "explanation": question["explanation"],
                "score_so_far": new_correct,
                "total_answered": new_answered,
                "feedback": feedback,
            },
            "next_question": next_question,
            "session_complete": is_complete,
        }

    except Exception as e:
        logger.error(f"Failed to submit answer: {e}")
        raise
