"""Embedding generation service using OpenAI API."""

import logging

from openai import OpenAI

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Initialize OpenAI client
client = OpenAI(api_key=settings.openai_api_key)

# OpenAI embedding model
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536
# OpenAI has a limit of 100 texts per request
MAX_BATCH_SIZE = 100


def get_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings for a list of texts using OpenAI API.

    Args:
        texts: List of text strings to embed.

    Returns:
        List of embedding vectors (list of floats).
        Returns empty list if input is empty or all texts fail.
    """
    if not texts:
        logger.warning("Empty texts list provided for embedding")
        return []
    
    # Filter out empty texts
    valid_texts = [text for text in texts if text and text.strip()]
    if not valid_texts:
        logger.warning("No valid texts to embed")
        return []
    
    all_embeddings = []
    
    try:
        # Process in batches if needed
        for i in range(0, len(valid_texts), MAX_BATCH_SIZE):
            batch = valid_texts[i:i + MAX_BATCH_SIZE]
            
            response = client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=batch
            )
            
            batch_embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(batch_embeddings)
            
            logger.info(f"Generated embeddings for batch {i // MAX_BATCH_SIZE + 1}: {len(batch)} texts")
        
        logger.info(f"Generated {len(all_embeddings)} embeddings total")
        return all_embeddings
    except Exception as e:
        logger.error(f"Failed to generate embeddings: {e}")
        return []
