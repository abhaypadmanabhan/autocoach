"""Quiz generation service using LLMs."""

import json
import logging

from pydantic import ValidationError

from app.core.supabase import supabase_admin
from app.models.quiz import LLMQuestion
from app.observability.langfuse import observe
from app.services.retrieval import retrieve_relevant_chunks
from app.services.llm import call_kimi, call_openai

logger = logging.getLogger(__name__)

STOP_WORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "can", "shall", "it", "its", "this",
    "that", "these", "those", "i", "you", "he", "she", "we", "they", "my",
    "your", "his", "her", "our", "their", "not", "no", "as", "if", "so",
}

QUIZ_SYSTEM_PROMPT = """You are an expert tutor creating quiz questions. Generate questions based ONLY on the provided content.

Rules:
- Questions must be directly answerable from the content
- For text_mcq: provide exactly 4 options, only one correct
- For text_tf: create a statement that is clearly true or false based on content
- For text_free: ask questions requiring short explanations
- Vary question difficulty based on the difficulty parameter
- Return valid JSON only, no markdown, no explanation
- The question_type field must be exactly one of: "text_mcq", "text_tf", "text_free"

Output format (JSON array):
[
  {
    "question_type": "text_mcq",
    "question_text": "What is...?",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct_answer": "A",
    "explanation": "Brief explanation why this is correct",
    "concept_id": "optional-uuid-if-targeting-concepts"
  },
  {
    "question_type": "text_tf",
    "question_text": "Statement to evaluate",
    "correct_answer": "true",
    "explanation": "Why this is true/false",
    "concept_id": "optional-uuid-if-targeting-concepts"
  },
  {
    "question_type": "text_free",
    "question_text": "Explain how...?",
    "correct_answer": "Key points that should be mentioned",
    "explanation": "What a good answer should include",
    "concept_id": "optional-uuid-if-targeting-concepts"
  }
]
"""


def _tokenize_keywords(text: str) -> list[str]:
    """Extract meaningful keywords from text, filtering stop words."""
    words = text.lower().split()
    return [w.strip(".,;:!?()[]{}\"'") for w in words if w.strip(".,;:!?()[]{}\"'") not in STOP_WORDS and len(w) > 1]


def get_targeted_chunks(document_id: str, focus_concept_ids: list[str], limit_chars: int = 12000) -> list[dict]:
    """
    Retrieve chunks relevant to specific concepts using keyword matching.

    Args:
        document_id: The document to get chunks from.
        focus_concept_ids: Concept UUIDs to target.
        limit_chars: Max total characters of chunk content to return.

    Returns:
        List of chunk dicts with 'content' and 'chunk_index' keys.
    """
    try:
        # Fetch concept details
        concepts_res = (
            supabase_admin.table("concepts")
            .select("id, concept_name, concept_description")
            .in_("id", focus_concept_ids)
            .execute()
        )
        concepts = concepts_res.data or []

        if not concepts:
            logger.warning(f"No concepts found for IDs: {focus_concept_ids}")
            return []

        # Build keyword lists from concept names and descriptions
        name_keywords = []
        desc_keywords = []
        for c in concepts:
            name_keywords.extend(_tokenize_keywords(c.get("concept_name", "")))
            desc_keywords.extend(_tokenize_keywords(c.get("concept_description", "")))

        # Fetch all chunks for the document
        chunks_res = (
            supabase_admin.table("chunks")
            .select("content, chunk_index")
            .eq("document_id", document_id)
            .order("chunk_index")
            .execute()
        )
        all_chunks = chunks_res.data or []

        if not all_chunks:
            logger.warning(f"No chunks found for document {document_id}")
            return []

        # Score each chunk by keyword matching
        scored_chunks = []
        for chunk in all_chunks:
            content_lower = chunk["content"].lower()
            score = 0
            for kw in name_keywords:
                score += content_lower.count(kw) * 2
            for kw in desc_keywords:
                score += content_lower.count(kw)
            scored_chunks.append((score, chunk))

        # Sort by score descending
        scored_chunks.sort(key=lambda x: x[0], reverse=True)

        # Accumulate chunks until limit_chars
        selected = []
        total_chars = 0
        for score, chunk in scored_chunks:
            if score == 0:
                break
            chunk_len = len(chunk["content"])
            if total_chars + chunk_len > limit_chars and selected:
                break
            selected.append(chunk)
            total_chars += chunk_len

        # Fallback: if no chunks scored > 0, return first N chunks by index
        if not selected:
            logger.info("No keyword-matched chunks, falling back to first chunks by index")
            total_chars = 0
            for chunk in all_chunks:
                chunk_len = len(chunk["content"])
                if total_chars + chunk_len > limit_chars and selected:
                    break
                selected.append(chunk)
                total_chars += chunk_len

        logger.info(f"get_targeted_chunks: selected {len(selected)} chunks ({total_chars} chars) for {len(concepts)} concepts")
        return selected

    except Exception as e:
        logger.error(f"Failed to get targeted chunks: {e}")
        return []


def validate_question_alignment(question: dict, concept_names: list[str]) -> bool:
    """
    Check if a question is aligned with at least one target concept.

    Args:
        question: Question dict with question_text, correct_answer, explanation.
        concept_names: List of concept name strings to check against.

    Returns:
        True if at least one concept keyword appears in the question content.
    """
    # Combine searchable text from the question
    searchable = " ".join([
        question.get("question_text", ""),
        question.get("correct_answer", ""),
        question.get("explanation", ""),
    ]).lower()

    for name in concept_names:
        keywords = _tokenize_keywords(name)
        for kw in keywords:
            if kw in searchable:
                return True
    return False


def _parse_llm_questions(
    response: str, focus_concept_ids: list[str] | None = None
) -> list[dict]:
    """Parse and validate LLM JSON response into question dicts."""
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

    valid_questions = []
    try:
        for q in questions:
            valid_questions.append(
                LLMQuestion.model_validate(
                    q,
                    context={"focus_concept_ids": focus_concept_ids or []},
                ).model_dump(mode="json", exclude_none=True)
            )
    except ValidationError as e:
        logger.warning("LLM quiz output failed validation: %s", e)
        return []

    return valid_questions


def _retry_generation_once(
    user_prompt: str, focus_concept_ids: list[str] | None = None
) -> list[dict]:
    logger.warning("LLM quiz output failed validation, retrying generation once")
    retry_response = call_kimi(QUIZ_SYSTEM_PROMPT, user_prompt)
    if not retry_response:
        retry_response = call_openai(QUIZ_SYSTEM_PROMPT, user_prompt, temperature=0.7)
    if not retry_response:
        return []
    return _parse_llm_questions(retry_response, focus_concept_ids=focus_concept_ids)


@observe(name="quiz.generate_questions", as_type="generation")
def generate_quiz_questions(
    document_id: str,
    num_questions: int = 5,
    difficulty: str = "medium",
    question_types: list[str] = None,
    target_concepts: list[dict] = None,
    focus_concept_ids: list[str] | None = None,
) -> list[dict]:
    """
    Generate quiz questions from document content using LLM.

    Args:
        document_id: The ID of the document to generate questions from.
        num_questions: Number of questions to generate (default 5).
        difficulty: Difficulty level - "easy", "medium", or "hard".
        question_types: List of question types to include (mcq, true_false, free_text).
        target_concepts: List of dicts [{"name":Str, "description":Str}] to focus on.
        focus_concept_ids: List of concept UUIDs for targeted chunk retrieval.

    Returns:
        List of question dictionaries, or empty list on failure.
    """
    if question_types is None:
        question_types = ["text_mcq", "text_tf", "text_free"]

    try:
        # Determine chunk retrieval strategy
        if focus_concept_ids and target_concepts:
            # Targeted mode: keyword-based chunk retrieval
            chunks = get_targeted_chunks(document_id, focus_concept_ids)
            if not chunks:
                logger.warning("Targeted chunks empty, falling back to RAG retrieval")
                chunks = retrieve_relevant_chunks(
                    query="Generate quiz questions covering key concepts",
                    document_id=document_id,
                    top_k=num_questions * 3,
                )
        else:
            # Default RAG-based retrieval
            top_k = num_questions * 3
            query = "Generate quiz questions covering key concepts"
            target_names = []
            if target_concepts:
                target_names = [c.get("name") or c.get("concept_name") or "Unnamed" for c in target_concepts]
                concepts_str = ", ".join(target_names)
                query = f"Generate quiz questions about: {concepts_str}"

            chunks = retrieve_relevant_chunks(
                query=query,
                document_id=document_id,
                top_k=top_k,
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

        focus_instruction = ""
        concept_id_map = {}
        if target_concepts:
            # Build concept ID map for the LLM
            if focus_concept_ids and len(focus_concept_ids) == len(target_concepts):
                for cid, tc in zip(focus_concept_ids, target_concepts):
                    concept_id_map[tc.get("name") or tc.get("concept_name") or "Unnamed"] = cid

            focus_details = []
            for c in target_concepts:
                name = c.get("name") or c.get("concept_name") or "Unnamed"
                desc = c.get("description") or c.get("concept_description") or ""
                cid = concept_id_map.get(name, "")
                if desc:
                    focus_details.append(f"- {name} (concept_id: \"{cid}\"): {desc}")
                else:
                    focus_details.append(f"- {name} (concept_id: \"{cid}\")")

            focus_block = "\n".join(focus_details)
            focus_instruction = f"""

STRICT CONCEPT TARGETING:
Generate questions ONLY about these concepts:
{focus_block}

Rules for targeted mode:
- Every question MUST be clearly about exactly one of the listed concepts
- Include "concept_id" field in each question JSON with the UUID of the concept it tests
- Do NOT generate generic or off-topic questions
- If you cannot create a question about a specific concept from the content, skip it
- The question text should directly reference or test knowledge of the target concept"""

        user_prompt = f"""Based on the following content, generate {num_questions} quiz questions.{focus_instruction}

Difficulty: {difficulty}
Question types to include: {types_str}

CONTENT:
{context}

Generate exactly {num_questions} questions mixing the requested types based on difficulty level '{difficulty}'.
For easy: focus on basic recall and simple facts
For medium: focus on understanding and application
For hard: focus on analysis, synthesis, and deeper concepts

Return ONLY a valid JSON array with no markdown formatting."""

        # Call LLM
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
            valid_questions = _parse_llm_questions(
                response, focus_concept_ids=focus_concept_ids
            )
            if not valid_questions:
                valid_questions = _retry_generation_once(
                    user_prompt, focus_concept_ids=focus_concept_ids
                )
                if not valid_questions:
                    return []

            # Validate alignment for targeted mode
            if target_concepts and valid_questions:
                concept_names = [c.get("name") or c.get("concept_name") or "" for c in target_concepts]
                aligned = [validate_question_alignment(q, concept_names) for q in valid_questions]
                misaligned_count = sum(1 for a in aligned if not a)
                total = len(valid_questions)

                if total > 0 and misaligned_count / total > 0.3:
                    logger.warning(
                        f"Alignment check: {misaligned_count}/{total} questions misaligned, regenerating"
                    )
                    # Regenerate with stronger instruction
                    stronger_prompt = user_prompt + (
                        "\n\nIMPORTANT: Previous generation was too generic. "
                        "Every question MUST directly reference the target concept in the question text. "
                        "Do not create questions about general topics."
                    )
                    retry_response = call_kimi(QUIZ_SYSTEM_PROMPT, stronger_prompt)
                    if not retry_response:
                        retry_response = call_openai(QUIZ_SYSTEM_PROMPT, stronger_prompt, temperature=0.7)

                    if retry_response:
                        try:
                            retry_questions = _parse_llm_questions(
                                retry_response,
                                focus_concept_ids=focus_concept_ids,
                            )
                            if retry_questions:
                                valid_questions = retry_questions
                                logger.info(f"Regeneration produced {len(retry_questions)} questions")
                        except json.JSONDecodeError:
                            logger.warning("Regeneration parse failed, using original questions")

            logger.info(f"Successfully generated {len(valid_questions)} questions")
            return valid_questions[:num_questions]

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.debug(f"Raw response: {response}")
            return []

    except Exception as e:
        logger.error(f"Failed to generate quiz questions: {e}")
        return []


def generate_single_question(
    document_id: str,
    concept: dict,
    difficulty: str = "medium",
    question_types: list[str] | None = None,
) -> dict | None:
    """Generate a single quiz question for one concept.

    `concept` must have at least `id` and `concept_name`; `concept_description`
    optional. Returns the question dict (with concept_id annotated) or None.
    """
    if question_types is None:
        question_types = ["text_mcq", "text_tf", "text_free"]

    target = {
        "name": concept.get("concept_name") or concept.get("name") or "Unnamed",
        "description": concept.get("concept_description") or concept.get("description") or "",
    }
    cid = concept.get("id")

    questions = generate_quiz_questions(
        document_id=document_id,
        num_questions=1,
        difficulty=difficulty,
        question_types=question_types,
        target_concepts=[target],
        focus_concept_ids=[cid] if cid else None,
    )

    if not questions:
        return None

    q = questions[0]
    if cid and not q.get("concept_id"):
        q["concept_id"] = cid
    return q
