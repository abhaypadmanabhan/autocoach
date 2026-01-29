"""Quiz generation service using LLMs."""

import json
import logging

from app.services.retrieval import retrieve_relevant_chunks
from app.services.llm import call_kimi, call_openai

logger = logging.getLogger(__name__)

QUIZ_SYSTEM_PROMPT = """You are an expert tutor creating quiz questions. Generate questions based ONLY on the provided content.

Rules:
- Questions must be directly answerable from the content
- For MCQ: provide exactly 4 options, only one correct
- For true_false: create a statement that is clearly true or false based on content
- For free_text: ask questions requiring short explanations
- Vary question difficulty based on the difficulty parameter
- Return valid JSON only, no markdown, no explanation

Output format (JSON array):
[
  {
    "question_type": "mcq",
    "question_text": "What is...?",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct_answer": "A",
    "explanation": "Brief explanation why this is correct"
  },
  {
    "question_type": "true_false", 
    "question_text": "Statement to evaluate",
    "correct_answer": "true",
    "explanation": "Why this is true/false"
  },
  {
    "question_type": "free_text",
    "question_text": "Explain how...?",
    "correct_answer": "Key points that should be mentioned",
    "explanation": "What a good answer should include"
  }
]
"""


def generate_quiz_questions(
    document_id: str,
    num_questions: int = 5,
    difficulty: str = "medium",
    question_types: list[str] = None
) -> list[dict]:
    """
    Generate quiz questions from document content using LLM.

    Args:
        document_id: The ID of the document to generate questions from.
        num_questions: Number of questions to generate (default 5).
        difficulty: Difficulty level - "easy", "medium", or "hard".
        question_types: List of question types to include (mcq, true_false, free_text).

    Returns:
        List of question dictionaries, or empty list on failure.
    """
    if question_types is None:
        question_types = ["mcq", "true_false", "free_text"]

    try:
        # Retrieve more chunks than needed for variety
        top_k = num_questions * 3
        chunks = retrieve_relevant_chunks(
            query="Generate quiz questions covering key concepts",
            document_id=document_id,
            top_k=top_k
        )

        if not chunks:
            logger.error(f"No chunks retrieved for document {document_id}")
            return []

        logger.info(f"Retrieved {len(chunks)} chunks for quiz generation")

        # Build context string from chunks
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            context_parts.append(f"[Chunk {i}]\n{chunk['content']}")
        context = "\n\n".join(context_parts)

        # Build user prompt
        types_str = ", ".join(question_types)
        user_prompt = f"""Based on the following content, generate {num_questions} quiz questions.

Difficulty: {difficulty}
Question types to include: {types_str}

CONTENT:
{context}

Generate exactly {num_questions} questions mixing the requested types based on difficulty level '{difficulty}'.
For easy: focus on basic recall and simple facts
For medium: focus on understanding and application
For hard: focus on analysis, synthesis, and deeper concepts

Return ONLY a valid JSON array with no markdown formatting."""

        # Call Kimi API
        logger.info(f"Calling Kimi API to generate {num_questions} questions")
        response = call_kimi(QUIZ_SYSTEM_PROMPT, user_prompt)

        if not response:
            logger.warning("Kimi API returned empty response, trying OpenAI fallback")
            response = call_openai(QUIZ_SYSTEM_PROMPT, user_prompt, temperature=0.7)

        if not response:
            logger.error("Both LLM APIs returned empty responses")
            return []

        # Parse JSON response
        try:
            # Clean up response - remove markdown code blocks if present
            cleaned_response = response.strip()
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.startswith("```"):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]
            cleaned_response = cleaned_response.strip()

            questions = json.loads(cleaned_response)

            if not isinstance(questions, list):
                logger.error(f"Parsed JSON is not a list: {type(questions)}")
                return []

            # Validate and clean questions
            valid_questions = []
            for q in questions:
                if isinstance(q, dict) and "question_text" in q and "question_type" in q:
                    valid_questions.append(q)

            logger.info(f"Successfully generated {len(valid_questions)} questions")
            return valid_questions[:num_questions]

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.debug(f"Raw response: {response}")
            return []

    except Exception as e:
        logger.error(f"Failed to generate quiz questions: {e}")
        return []
