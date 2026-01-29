"""Answer evaluation service for quiz questions."""

import json
import logging

from app.services.llm import call_kimi, call_openai

logger = logging.getLogger(__name__)


def normalize_answer(answer: str) -> str:
    """Normalize an answer string for comparison."""
    return answer.strip().lower()


def normalize_mcq_answer(answer: str) -> str:
    """Normalize MCQ answer to single letter (A, B, C, D)."""
    normalized = answer.strip().upper()
    # If answer is like "A) option text", extract just "A"
    if len(normalized) > 1 and normalized[1] in [")", ".", " "]:
        normalized = normalized[0]
    # If answer is just the letter
    if len(normalized) == 1 and normalized in "ABCD":
        return normalized
    return normalized


def evaluate_mcq(user_answer: str, correct_answer: str) -> tuple[bool, str]:
    """
    Evaluate a multiple choice question answer.

    Args:
        user_answer: The user's answer (e.g., "A", "A) option", "option text").
        correct_answer: The correct answer (e.g., "A", "A) option").

    Returns:
        Tuple of (is_correct, feedback_message).
    """
    user_normalized = normalize_mcq_answer(user_answer)
    correct_normalized = normalize_mcq_answer(correct_answer)

    is_correct = user_normalized == correct_normalized

    if is_correct:
        feedback = "Correct! Well done."
    else:
        feedback = f"Incorrect. The correct answer is {correct_normalized}."

    return is_correct, feedback


def evaluate_true_false(user_answer: str, correct_answer: str) -> tuple[bool, str]:
    """
    Evaluate a true/false question answer.

    Args:
        user_answer: The user's answer (e.g., "true", "t", "yes", "false", "f", "no").
        correct_answer: The correct answer ("true" or "false").

    Returns:
        Tuple of (is_correct, feedback_message).
    """
    # Normalize user answer
    user_normalized = normalize_answer(user_answer)
    # Map variations to true/false
    true_variations = {"true", "t", "yes", "1", "correct", "right"}
    false_variations = {"false", "f", "no", "0", "incorrect", "wrong", "not true"}

    user_bool = None
    if user_normalized in true_variations:
        user_bool = True
    elif user_normalized in false_variations:
        user_bool = False

    # Normalize correct answer
    correct_normalized = normalize_answer(correct_answer)
    correct_bool = correct_normalized in true_variations

    if user_bool is None:
        return False, "Could not determine your answer. Please answer with 'true' or 'false'."

    is_correct = user_bool == correct_bool

    if is_correct:
        feedback = f"Correct! The statement is {correct_answer}."
    else:
        feedback = f"Incorrect. The statement is {correct_answer}."

    return is_correct, feedback


FREE_TEXT_EVAL_PROMPT = """You are an expert tutor evaluating a student's answer to a quiz question.

Question: {question_text}

Model Answer (what a good answer should include): {correct_answer}

Student's Answer: {user_answer}

Evaluate the student's answer:
1. Compare it to the model answer
2. Determine if it demonstrates understanding (doesn't need to be word-for-word)
3. Score as correct if the key concepts are present, partially correct if some concepts are present, or incorrect if wrong/missing

Return ONLY a JSON object in this exact format:
{{
  "is_correct": true/false,
  "feedback": "Constructive feedback explaining what was good and what could be improved"
}}

Rules:
- is_correct: true if the answer captures the main points, false otherwise
- feedback: Be encouraging but specific about what was missing or incorrect
- The student doesn't need to match the model answer exactly, just convey the same understanding
"""


def evaluate_free_text(
    user_answer: str, correct_answer: str, question_text: str
) -> tuple[bool, str, str]:
    """
    Evaluate a free text question answer using LLM.

    Args:
        user_answer: The user's answer.
        correct_answer: The model/correct answer.
        question_text: The question text for context.

    Returns:
        Tuple of (is_correct, feedback, explanation).
    """
    try:
        # Build evaluation prompt
        prompt = FREE_TEXT_EVAL_PROMPT.format(
            question_text=question_text,
            correct_answer=correct_answer,
            user_answer=user_answer
        )

        # Call LLM for evaluation
        response = call_kimi(
            system_prompt="You are an expert tutor providing constructive feedback on student answers.",
            user_prompt=prompt
        )

        if not response:
            logger.warning("Kimi evaluation failed, trying OpenAI fallback")
            response = call_openai(
                system_prompt="You are an expert tutor providing constructive feedback on student answers.",
                user_prompt=prompt,
                temperature=0.3
            )

        if not response:
            logger.error("Both LLM evaluations failed")
            # Fallback: basic length-based evaluation
            if len(user_answer.strip()) < 10:
                return False, "Your answer seems too brief. Please provide more detail.", correct_answer
            return True, "Answer received. (Automated evaluation unavailable)", correct_answer

        # Parse JSON response
        try:
            # Clean up response
            cleaned = response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            result = json.loads(cleaned)
            is_correct = result.get("is_correct", False)
            feedback = result.get("feedback", "Answer evaluated.")

            return is_correct, feedback, correct_answer

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse evaluation JSON: {e}")
            # Fallback
            return True, "Answer received. (Evaluation parsing failed)", correct_answer

    except Exception as e:
        logger.error(f"Error evaluating free text answer: {e}")
        return False, "Could not evaluate answer. Please try again.", correct_answer


def evaluate_answer(
    question_type: str,
    user_answer: str,
    correct_answer: str,
    question_text: str = ""
) -> dict:
    """
    Route answer evaluation to the appropriate evaluator.

    Args:
        question_type: Type of question (mcq, true_false, free_text).
        user_answer: The user's answer.
        correct_answer: The correct answer.
        question_text: The question text (for free_text evaluation context).

    Returns:
        Dictionary with is_correct and feedback.
    """
    question_type = question_type.lower()

    if question_type == "mcq":
        is_correct, feedback = evaluate_mcq(user_answer, correct_answer)
        return {"is_correct": is_correct, "feedback": feedback}

    elif question_type in ["true_false", "truefalse", "tf"]:
        is_correct, feedback = evaluate_true_false(user_answer, correct_answer)
        return {"is_correct": is_correct, "feedback": feedback}

    elif question_type in ["free_text", "freetext", "free", "text"]:
        is_correct, feedback, explanation = evaluate_free_text(
            user_answer, correct_answer, question_text
        )
        return {
            "is_correct": is_correct,
            "feedback": feedback,
            "explanation": explanation
        }

    else:
        logger.warning(f"Unknown question type: {question_type}")
        # Default to direct string comparison
        is_correct = normalize_answer(user_answer) == normalize_answer(correct_answer)
        return {
            "is_correct": is_correct,
            "feedback": "Correct!" if is_correct else "Incorrect."
        }
