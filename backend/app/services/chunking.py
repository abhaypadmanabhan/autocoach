"""Text chunking service using LangChain text splitters."""

import logging

from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)


def chunk_text(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> list[dict]:
    """
    Split text into chunks using RecursiveCharacterTextSplitter.

    Args:
        text: The text to split into chunks.
        chunk_size: The target size of each chunk in characters.
        chunk_overlap: The number of characters to overlap between chunks.

    Returns:
        A list of dictionaries containing chunk information:
        [{"content": str, "chunk_index": int, "metadata": {}}]
    """
    if not text or not text.strip():
        logger.warning("Empty text provided for chunking")
        return []
    
    try:
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
            is_separator_regex=False,
        )
        
        chunks = text_splitter.split_text(text)
        
        # Filter out empty or whitespace-only chunks
        valid_chunks = [
            {
                "content": chunk.strip(),
                "chunk_index": i,
                "metadata": {}
            }
            for i, chunk in enumerate(chunks)
            if chunk and chunk.strip()
        ]
        
        logger.info(f"Split text into {len(valid_chunks)} chunks")
        return valid_chunks
    except Exception as e:
        logger.error(f"Failed to chunk text: {e}")
        return []
