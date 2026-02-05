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


class RegisterDocumentRequest(BaseModel):
    """Request model for registering a document uploaded directly to storage."""

    filename: str
    file_path: str
    file_type: str
    file_size: int


class SearchRequest(BaseModel):
    """Request model for searching within a document."""

    query: str
    top_k: int = 5


class ChunkResult(BaseModel):
    """Model for a single search result chunk."""

    content: str
    chunk_index: int
    score: float


    query: str
    document_id: str
    results: list[ChunkResult]


class ConceptSchema(BaseModel):
    """Schema for a learning concept with user mastery data."""

    id: UUID
    concept_name: str
    concept_description: str | None = None
    importance_score: float
    is_core: bool
    parent_concept_id: UUID | None = None
    created_at: datetime
    
    # User mastery fields (zeroed if not present)
    mastery_score: float = 0.0
    times_tested: int = 0
    times_correct: int = 0
    last_tested_at: datetime | None = None
    mastered_at: datetime | None = None


class DocumentConceptsResponse(BaseModel):
    """Response model for a document's concepts."""
    
    document_id: UUID
    concepts: list[ConceptSchema]
