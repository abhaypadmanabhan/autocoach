"""Quiz generation API routes."""

import logging

from fastapi import APIRouter, HTTPException, Depends

from app.models.quiz import QuizGenerateRequest, QuizGenerateResponse, QuestionSchema
from app.services.quiz_generator import generate_quiz_questions
from app.api.routes.documents import get_user_id_from_token
from app.core.supabase import supabase_admin

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/generate", response_model=QuizGenerateResponse)
async def generate_quiz(
    request: QuizGenerateRequest,
    user_id=Depends(get_user_id_from_token)
):
    """
    Generate a quiz from a document.

    Args:
        request: The quiz generation request containing document_id, num_questions,
                 difficulty, and question_types.
        user_id: The authenticated user's ID (from token).

    Returns:
        QuizGenerateResponse with the generated questions.

    Raises:
        HTTPException: 404 if document not found or doesn't belong to user.
        HTTPException: 400 if document is not ready for quiz generation.
        HTTPException: 500 if question generation fails.
    """
    try:
        # Verify document exists and belongs to user
        response = (
            supabase_admin.table("documents")
            .select("*")
            .eq("id", request.document_id)
            .eq("user_id", str(user_id))
            .execute()
        )

        if not response.data or len(response.data) == 0:
            raise HTTPException(
                status_code=404,
                detail="Document not found"
            )

        doc = response.data[0]

        # Verify document is ready
        if doc["status"] != "ready":
            raise HTTPException(
                status_code=400,
                detail=f"Document is not ready for quiz generation. Current status: {doc['status']}"
            )

        logger.info(f"Generating quiz for document {request.document_id} "
                   f"({request.num_questions} questions, {request.difficulty} difficulty)")

        # Generate quiz questions
        questions_data = generate_quiz_questions(
            document_id=request.document_id,
            num_questions=request.num_questions,
            difficulty=request.difficulty,
            question_types=request.question_types
        )

        if not questions_data:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate quiz questions. Please try again."
            )

        # Convert to QuestionSchema models
        questions = [
            QuestionSchema(
                question_type=q.get("question_type", "unknown"),
                question_text=q.get("question_text", ""),
                options=q.get("options"),
                correct_answer=q.get("correct_answer", ""),
                explanation=q.get("explanation")
            )
            for q in questions_data
        ]

        logger.info(f"Successfully generated quiz with {len(questions)} questions")

        return QuizGenerateResponse(
            document_id=request.document_id,
            difficulty=request.difficulty,
            questions=questions
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error generating quiz: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate quiz: {str(e)}"
        )
