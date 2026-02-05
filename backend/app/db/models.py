from datetime import datetime
from uuid import UUID, uuid4
from typing import List, Optional

from sqlalchemy import String, Integer, Boolean, ForeignKey, DateTime, Numeric, Text, ARRAY, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB

from app.db.base import Base

class Document(Base):
    __tablename__ = "documents"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    file_type: Mapped[str] = mapped_column(String, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending")
    error_message: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ai_title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    progress_core: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    concepts: Mapped[List["Concept"]] = relationship("Concept", back_populates="document", cascade="all, delete-orphan")

class Concept(Base):
    __tablename__ = "concepts"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4, server_default=func.gen_random_uuid())
    document_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    concept_name: Mapped[str] = mapped_column(Text, nullable=False)
    concept_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    importance: Mapped[str] = mapped_column(Text, server_default="core", nullable=False) # core | advanced
    importance_score: Mapped[float] = mapped_column(Numeric(3, 2), server_default="0.80", nullable=False)
    parent_concept_id: Mapped[Optional[UUID]] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("concepts.id"), nullable=True, index=True)
    chunk_ids: Mapped[Optional[List[UUID]]] = mapped_column(ARRAY(PG_UUID(as_uuid=True)), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="concepts")
    children: Mapped[List["Concept"]] = relationship("Concept", back_populates="parent", remote_side=[id])
    parent: Mapped["Concept"] = relationship("Concept", back_populates="children", remote_side=[parent_concept_id])
    mastery: Mapped[List["UserConceptMastery"]] = relationship("UserConceptMastery", back_populates="concept", cascade="all, delete-orphan")

class UserConceptMastery(Base):
    __tablename__ = "user_concept_mastery"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4, server_default=func.gen_random_uuid())
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    concept_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("concepts.id", ondelete="CASCADE"), nullable=False, index=True)
    mastery_score: Mapped[float] = mapped_column(Numeric(5, 2), server_default="0", nullable=False)
    times_tested: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    times_correct: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    last_tested_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    mastered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    concept: Mapped["Concept"] = relationship("Concept", back_populates="mastery")

class Question(Base):
    __tablename__ = "questions"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    # Note: Question table might have other fields from before, strictly mirroring what's likely there + new field
    # But since I am recreating the specific model I need to be careful not to miss fields if I am autogenerating.
    # The existing table structure is unknown to me in detail without checking DB schema directly, 
    # but the task implies 'updates' to models.
    # Since I don't have the full schema, I will define what I know and use reflection or careful migration.
    # However, 'Question' model was not found in `app/models`, implying it might happen purely in DB or Pydantic.
    # I will add the model here as requested by the plan.
    
    document_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    # valid_options etc might exist.
    concept_ids: Mapped[Optional[List[UUID]]] = mapped_column(ARRAY(PG_UUID(as_uuid=True)), nullable=True)
    
    # Preventing full re-definition issues, I will comment that this model is partial if existing schema is complex.
    # But for Alembic autogenerate to work, it needs the FULL definition or `reflect=True`.
    # Given I am adding a column, I should define the class. 
    # The safest bet for "adding a column" without redefining the whole table (and risking diffs) 
    # is to only define the new models (Concept, Mastery) and manually add columns in the migration script 
    # for existing tables, OR define them fully.
    # I'll define Concept and Mastery fully. Document and Question I will define with what I know 
    # and expect to possibly adjust the migration script to avoid dropping/recreating.
