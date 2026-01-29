from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    """Response model for a document."""

    id: UUID
    filename: str
    file_type: str
    file_size: int
    status: str
    created_at: datetime


class DocumentListResponse(BaseModel):
    """Response model for a list of documents."""

    documents: list[DocumentResponse]


class SearchRequest(BaseModel):
    """Request model for searching within a document."""

    query: str
    top_k: int = 5


class ChunkResult(BaseModel):
    """Model for a single search result chunk."""

    content: str
    chunk_index: int
    score: float


class SearchResponse(BaseModel):
    """Response model for document search."""

    query: str
    document_id: str
    results: list[ChunkResult]
