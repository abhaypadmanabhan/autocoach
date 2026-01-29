"""RAG retrieval service for searching relevant document chunks."""

import logging

from app.services.embeddings import get_embeddings
from app.core.qdrant import search_vectors

logger = logging.getLogger(__name__)


def retrieve_relevant_chunks(query: str, document_id: str, top_k: int = 5) -> list[dict]:
    """
    Retrieve relevant chunks from a document based on a query.

    Args:
        query: The search query text.
        document_id: The ID of the document to search within.
        top_k: Number of top results to return.

    Returns:
        List of dictionaries containing chunk information:
        [{"content": str, "chunk_index": int, "score": float}]
    """
    try:
        # Get embedding for the query
        embeddings = get_embeddings([query])
        if not embeddings:
            logger.error("Failed to generate embedding for query")
            return []
        
        query_embedding = embeddings[0]
        
        # Search vectors in Qdrant
        results = search_vectors(
            query_embedding=query_embedding,
            document_id=document_id,
            top_k=top_k
        )
        
        logger.info(f"Retrieved {len(results)} relevant chunks for document {document_id}")
        return results
    except Exception as e:
        logger.error(f"Failed to retrieve relevant chunks: {e}")
        return []
