"""Voice transcription service using OpenAI Whisper."""

import logging
import tempfile
import os

from openai import OpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Max file size: 25MB (OpenAI's limit)
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

# Allowed audio formats
ALLOWED_CONTENT_TYPES = {
    "audio/webm",
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/flac",
    "audio/m4a",
}


def transcribe_audio(audio_bytes: bytes, content_type: str = "audio/webm") -> str:
    """
    Transcribe audio using OpenAI Whisper API.
    
    Args:
        audio_bytes: The raw audio file bytes.
        content_type: The MIME type of the audio file.
        
    Returns:
        The transcribed text.
        
    Raises:
        ValueError: If the file is too large or has an invalid format.
        Exception: If transcription fails.
    """
    # Validate file size
    if len(audio_bytes) > MAX_FILE_SIZE_BYTES:
        raise ValueError(
            f"Audio file too large. Maximum size is {MAX_FILE_SIZE_BYTES / (1024 * 1024):.0f}MB. "
            f"Got {len(audio_bytes) / (1024 * 1024):.1f}MB."
        )
    
    # Determine file extension from content type
    extension = _get_extension_from_content_type(content_type)
    
    # Create temp file with proper extension
    with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as temp_file:
        temp_file.write(audio_bytes)
        temp_path = temp_file.name
    
    try:
        client = OpenAI(api_key=settings.openai_api_key)
        
        # Open the file for Whisper API
        with open(temp_path, "rb") as audio_file:
            # Use Whisper-1 model for transcription
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text"
            )
        
        # Response is a string when response_format="text"
        transcription = response if isinstance(response, str) else response.text
        
        logger.info(f"Transcription successful, text length: {len(transcription)}")
        return transcription.strip()
        
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise Exception(f"Failed to transcribe audio: {str(e)}")
    finally:
        # Clean up temp file
        try:
            os.unlink(temp_path)
        except OSError:
            pass


def _get_extension_from_content_type(content_type: str) -> str:
    """
    Get file extension from content type.
    
    Args:
        content_type: The MIME type.
        
    Returns:
        The file extension including the dot.
    """
    content_type = content_type.lower().split(";")[0].strip()
    
    mapping = {
        "audio/webm": ".webm",
        "audio/mp4": ".mp4",
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/wav": ".wav",
        "audio/ogg": ".ogg",
        "audio/flac": ".flac",
        "audio/m4a": ".m4a",
    }
    
    return mapping.get(content_type, ".webm")
