"""Voice transcription API routes."""

import logging
from uuid import UUID

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Header
from pydantic import BaseModel

from app.api.routes.documents import get_user_id_from_token
from app.services.voice import transcribe_audio, ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE_BYTES

logger = logging.getLogger(__name__)

router = APIRouter()


class TranscribeResponse(BaseModel):
    """Response model for transcription."""
    text: str


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_voice(
    audio: UploadFile = File(..., description="Audio file to transcribe (webm, mp3, wav, etc.)"),
    user_id: UUID = Depends(get_user_id_from_token)
):
    """
    Transcribe audio to text using OpenAI Whisper.
    
    This endpoint accepts audio files from the browser's MediaRecorder
    and returns the transcribed text. Authentication is required.
    
    Args:
        audio: The audio file to transcribe.
        user_id: The authenticated user's ID (from token).
        
    Returns:
        TranscribeResponse containing the transcribed text.
        
    Raises:
        HTTPException: 400 if the file type is invalid or file too large.
        HTTPException: 401 if the user is not authenticated.
        HTTPException: 500 if transcription fails.
    """
    try:
        # Validate content type
        content_type = audio.content_type or "audio/webm"
        base_content_type = content_type.lower().split(";")[0].strip()
        
        # Check if content type is allowed (be flexible with webm variants)
        is_allowed = (
            base_content_type in ALLOWED_CONTENT_TYPES or
            content_type.startswith("audio/webm") or
            content_type.startswith("audio/ogg")
        )
        
        if not is_allowed:
            logger.warning(f"Invalid content type: {content_type}")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid audio format. Allowed formats: webm, mp3, wav, ogg, m4a. Got: {content_type}"
            )
        
        # Read audio bytes
        audio_bytes = await audio.read()
        
        if len(audio_bytes) == 0:
            raise HTTPException(
                status_code=400,
                detail="Audio file is empty"
            )
        
        if len(audio_bytes) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"Audio file too large. Maximum size is {MAX_FILE_SIZE_BYTES / (1024 * 1024):.0f}MB"
            )
        
        logger.info(f"Transcribing audio for user {user_id}: {len(audio_bytes)} bytes, type: {content_type}")
        
        # Transcribe the audio
        text = transcribe_audio(audio_bytes, content_type)
        
        return TranscribeResponse(text=text)
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error during transcription: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to transcribe audio: {str(e)}"
        )
