"""Quiz session management service."""

import logging
from datetime import datetime, timezone
from uuid import uuid4

from app.core.supabase import supabase_admin
from app.services.quiz_generator import generate_quiz_questions
from app.services.answer_evaluator import evaluate_answer

logger = logging.getLogger(__name__)


def create_session(
    user_id: str,
    document_id: str,
    num_questions: int,
    difficulty: str,
    question_types: list[str]
) -> dict:
    """
    Create a new quiz session.

    Args:
        user_id: The user's ID.
        document_id: The document ID.
        num_questions: Number of questions to generate.
        difficulty: Difficulty level.
        question_types: Types of questions to include.

    Returns:
        Dictionary with session data and first question.
    """
    try:
        # Generate quiz questions
        questions = generate_quiz_questions(
            document_id=document_id,
            num_questions=num_questions,
            difficulty=difficulty,
            question_types=question_types
        )

        if not questions:
            logger.error("Failed to generate quiz questions")
            raise ValueError("Failed to generate quiz questions")

        # Create session record
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
            "completed_at": None
        }

        supabase_admin.table("quiz_sessions").insert(session_data).execute()

        # Create question records
        question_records = []
        for i, q in enumerate(questions, 1):
            question_record = {
                "id": str(uuid4()),
                "session_id": session_id,
                "question_number": i,
                "question_type": q.get("question_type", "unknown"),
                "question_text": q.get("question_text", ""),
                "options": q.get("options"),
                "correct_answer": q.get("correct_answer", ""),
                "explanation": q.get("explanation"),
                "user_answer": None,
                "is_correct": None,
                "input_method": None,
                "answered_at": None
            }
            question_records.append(question_record)

        # Insert questions in batches
        for i in range(0, len(question_records), 100):
            batch = question_records[i:i + 100]
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
                "difficulty": difficulty
            } if first_question else None
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
                "explanation": q["explanation"]
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
            "completed_at": session["completed_at"]
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
            logger.info(f"Session {session_id} is not active (status: {session['status']})")
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
            "difficulty": session["difficulty"]
        }

    except Exception as e:
        logger.error(f"Failed to get current question: {e}")
        return None


def submit_answer(
    session_id: str,
    user_id: str,
    question_id: str,
    answer: str,
    input_method: str
) -> dict:
    """
    Submit an answer for a question in a session.

    Args:
        session_id: The session ID.
        user_id: The user's ID (for verification).
        question_id: The question ID.
        answer: The user's answer.
        input_method: How the answer was input (typed/voice).

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
            question_text=question["question_text"]
        )

        is_correct = eval_result["is_correct"]
        feedback = eval_result.get("feedback", "")

        # Update question record
        now = datetime.now(timezone.utc).isoformat()
        supabase_admin.table("questions").update({
            "user_answer": answer,
            "is_correct": is_correct,
            "input_method": input_method,
            "answered_at": now
        }).eq("id", question_id).execute()

        # Update session counts
        new_answered = session["answered_questions"] + 1
        new_correct = session["correct_answers"] + (1 if is_correct else 0)

        session_update = {
            "answered_questions": new_answered,
            "correct_answers": new_correct
        }

        # Check if all questions answered
        is_complete = new_answered >= session["total_questions"]
        if is_complete:
            session_update["status"] = "completed"
            session_update["completed_at"] = now

        supabase_admin.table("quiz_sessions").update(session_update).eq(
            "id", session_id
        ).execute()

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
                    "difficulty": session["difficulty"]
                }

        return {
            "result": {
                "is_correct": is_correct,
                "correct_answer": question["correct_answer"],
                "explanation": question["explanation"],
                "score_so_far": new_correct,
                "total_answered": new_answered,
                "feedback": feedback
            },
            "next_question": next_question,
            "session_complete": is_complete
        }

    except Exception as e:
        logger.error(f"Failed to submit answer: {e}")
        raise
