from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentResponse(BaseModel):
    """Response model for a document."""

    id: UUID
    filename: str
    file_type: str
    file_size: int
    status: str
    ai_title: str | None = None
    session_id: str | None = None
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


class SearchResponse(BaseModel):
    """Response model for a document search."""

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


class DocumentProgressResponse(BaseModel):
    """Response model for document learning progress."""

    document_id: UUID
    document_title: str | None = None
    mastery_percent: int = Field(ge=0, le=100)
    concepts_total: int
    concepts_practiced: int
    weak_concepts_count: int
    mastered_concepts_count: int
    milestone: str  # "none" | "25" | "50" | "75" | "100"


class DocumentProgressSummaryResponse(BaseModel):
    """Response model for a list of document progress summaries."""

    documents: list[DocumentProgressResponse]


class DocumentSummarySchema(BaseModel):
    """Schema for generated document summary content."""

    one_liner: str
    what_youll_learn: list[str]
    key_concepts: list[str]
    study_plan: list[str]


class DocumentSummaryResponse(BaseModel):
    """Response model for a document summary."""

    document_id: UUID
    summary: DocumentSummarySchema
    generated_at: datetime | None = None
    version: str | None = None
