"""Qdrant vector database client and utilities."""

import logging
from uuid import uuid4

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Initialize Qdrant client
qdrant_client = QdrantClient(
    url=settings.qdrant_url,
    api_key=settings.qdrant_api_key,
)

# Default collection settings
DEFAULT_COLLECTION_NAME = "documents"
VECTOR_SIZE = 1536  # OpenAI text-embedding-3-small dimensions


def ensure_collection_exists(collection_name: str = DEFAULT_COLLECTION_NAME) -> None:
    """
    Check if a collection exists in Qdrant, create it if not.

    Args:
        collection_name: Name of the collection to check/create.
    """
    try:
        # Get list of existing collections
        collections = qdrant_client.get_collections()
        collection_names = [c.name for c in collections.collections]
        
        if collection_name in collection_names:
            logger.info(f"Collection '{collection_name}' already exists")
            return
        
        # Create collection
        qdrant_client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=VECTOR_SIZE,
                distance=Distance.COSINE
            )
        )
        logger.info(f"Created collection '{collection_name}' with vector size {VECTOR_SIZE}")
        
        # Create payload index for document_id to enable filtering
        try:
            qdrant_client.create_payload_index(
                collection_name=collection_name,
                field_name="document_id",
                field_schema="keyword"
            )
            logger.info(f"Created payload index for document_id in '{collection_name}'")
        except Exception as e:
            # Index might already exist, which is fine
            logger.info(f"Payload index creation note: {e}")
    except Exception as e:
        logger.error(f"Failed to ensure collection exists: {e}")
        raise


def create_document_id_index(collection_name: str = DEFAULT_COLLECTION_NAME) -> None:
    """
    Create payload index for document_id field.
    Call this once for existing collections.

    Args:
        collection_name: Name of the collection to create index on.
    """
    try:
        qdrant_client.create_payload_index(
            collection_name=collection_name,
            field_name="document_id",
            field_schema="keyword"
        )
        logger.info(f"Created document_id index on '{collection_name}'")
    except Exception as e:
        logger.info(f"Index creation note: {e}")


def store_vectors(
    document_id: str,
    chunks: list[dict],
    embeddings: list[list[float]],
    collection_name: str = DEFAULT_COLLECTION_NAME
) -> list[str]:
    """
    Store vector embeddings in Qdrant.

    Args:
        document_id: The ID of the document these chunks belong to.
        chunks: List of chunk dictionaries with 'content', 'chunk_index', and 'metadata'.
        embeddings: List of embedding vectors corresponding to chunks.
        collection_name: Name of the Qdrant collection to store in.

    Returns:
        List of point IDs (UUIDs) that were stored.
    """
    if not chunks or not embeddings:
        logger.warning("No chunks or embeddings to store")
        return []
    
    if len(chunks) != len(embeddings):
        logger.error(f"Mismatch between chunks ({len(chunks)}) and embeddings ({len(embeddings)})")
        raise ValueError("Chunks and embeddings must have the same length")
    
    try:
        point_ids = []
        points = []
        
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            point_id = str(uuid4())
            point_ids.append(point_id)
            
            point = PointStruct(
                id=point_id,
                vector=embedding,
                payload={
                    "document_id": document_id,
                    "content": chunk["content"],
                    "chunk_index": chunk["chunk_index"],
                    "metadata": chunk.get("metadata", {})
                }
            )
            points.append(point)
        
        # Upload points to Qdrant
        qdrant_client.upsert(
            collection_name=collection_name,
            points=points
        )
        
        logger.info(f"Stored {len(points)} vectors in collection '{collection_name}'")
        return point_ids
    except Exception as e:
        logger.error(f"Failed to store vectors: {e}")
        raise


def search_vectors(
    query_embedding: list[float],
    document_id: str,
    top_k: int = 5,
    collection_name: str = DEFAULT_COLLECTION_NAME
) -> list[dict]:
    """
    Search for similar vectors in Qdrant filtered by document_id.

    Args:
        query_embedding: The embedding vector to search for.
        document_id: The document ID to filter by.
        top_k: Number of top results to return.
        collection_name: Name of the Qdrant collection to search.

    Returns:
        List of dictionaries containing chunk information:
        [{"content": str, "chunk_index": int, "score": float}]
    """
    try:
        # Search in Qdrant using query_points (new API)
        results_wrapper = qdrant_client.query_points(
            collection_name=collection_name,
            query=query_embedding,
            query_filter=Filter(
                must=[
                    FieldCondition(
                        key="document_id",
                        match=MatchValue(value=document_id)
                    )
                ]
            ),
            limit=top_k
        )
        
        # Format results - access via results_wrapper.points
        results = [
            {
                "content": point.payload.get("content", ""),
                "chunk_index": point.payload.get("chunk_index", 0),
                "score": point.score
            }
            for point in results_wrapper.points
        ]
        
        logger.info(f"Search found {len(results)} results for document {document_id}")
        return results
    except Exception as e:
        logger.error(f"Failed to search vectors: {e}")
        raise


# Ensure collection exists on module load
try:
    ensure_collection_exists()
except Exception as e:
    logger.error(f"Failed to initialize Qdrant collection: {e}")
