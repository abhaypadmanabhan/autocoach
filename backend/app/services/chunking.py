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


def chunk_units(units: list[dict], chunk_size: int = 1000, chunk_overlap: int = 200) -> list[dict]:
    """
    Chunk each page or slide on its own, never across units.

    Args:
        units: [{"text": str, "metadata": {"page": n} or {"slide": n}}] in document order.

    Returns:
        [{"content": str, "chunk_index": int, "metadata": dict}] where chunk_index is a
        document-wide 0-based sequence and metadata is a copy of the unit's metadata.
    """
    chunks = []
    for unit in units:
        for piece in chunk_text(unit["text"], chunk_size=chunk_size, chunk_overlap=chunk_overlap):
            chunks.append({
                "content": piece["content"],
                "chunk_index": len(chunks),
                "metadata": dict(unit["metadata"]),
            })
    logger.info(f"Split {len(units)} units into {len(chunks)} chunks")
    return chunks
