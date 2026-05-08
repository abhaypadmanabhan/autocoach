from datetime import datetime, date
from uuid import UUID, uuid4
from typing import List, Optional

from sqlalchemy import (
    Integer,
    Boolean,
    ForeignKey,
    DateTime,
    Date,
    Numeric,
    Text,
    ARRAY,
    func,
    Index,
    CheckConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB, ENUM as PG_ENUM


from app.db.base import Base


class UserOnboarding(Base):
    __tablename__ = "user_onboarding"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    learning_topics: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    goal: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    study_frequency: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    experience_level: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        server_default=text("'beginner'::text"),
    )
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    email: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    full_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Daily Sprint fields
    streak_count: Mapped[int] = mapped_column(
        Integer, server_default="0", nullable=False
    )
    last_sprint_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    total_xp: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        Index("idx_documents_user_id", "user_id"),
        Index("idx_documents_status", "status"),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        nullable=False,
    )
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_type: Mapped[str] = mapped_column(Text, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default=text("'pending'::text"),
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    page_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    chunk_count: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        server_default=text("0"),
    )
    ai_title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    progress_core: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    concepts: Mapped[List["Concept"]] = relationship(
        "Concept", back_populates="document", cascade="all, delete-orphan"
    )


class Concept(Base):
    __tablename__ = "concepts"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        server_default=func.gen_random_uuid(),
    )
    document_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        index=True,
    )
    concept_name: Mapped[str] = mapped_column(Text, nullable=False)
    concept_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    importance: Mapped[str] = mapped_column(
        Text, server_default="core", nullable=False
    )  # core | advanced
    importance_score: Mapped[float] = mapped_column(
        Numeric(3, 2), server_default="0.80", nullable=False
    )
    parent_concept_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("concepts.id"), nullable=True, index=True
    )
    chunk_ids: Mapped[Optional[List[UUID]]] = mapped_column(
        ARRAY(PG_UUID(as_uuid=True)), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="concepts")
    children: Mapped[List["Concept"]] = relationship(
        "Concept", back_populates="parent", remote_side=[id]
    )
    parent: Mapped["Concept"] = relationship(
        "Concept", back_populates="children", remote_side=[parent_concept_id]
    )
    mastery: Mapped[List["UserConceptMastery"]] = relationship(
        "UserConceptMastery", back_populates="concept", cascade="all, delete-orphan"
    )


class UserConceptMastery(Base):
    __tablename__ = "user_concept_mastery"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), nullable=False, index=True
    )
    concept_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("concepts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mastery_score: Mapped[float] = mapped_column(
        Numeric(5, 2), server_default="0", nullable=False
    )
    times_tested: Mapped[int] = mapped_column(
        Integer, server_default="0", nullable=False
    )
    times_correct: Mapped[int] = mapped_column(
        Integer, server_default="0", nullable=False
    )
    last_tested_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    mastered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    concept: Mapped["Concept"] = relationship("Concept", back_populates="mastery")


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (Index("idx_questions_session_id", "session_id"),)

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        server_default=func.gen_random_uuid(),
    )
    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("quiz_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(
        PG_ENUM(
            "text_free",
            "text_mcq",
            "text_tf",
            "rendered",
            name="question_type_enum",
            create_type=False,
        ),
        nullable=False,
    )
    input_method: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    options: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    correct_answer: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    user_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    answered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    source_chunks: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    question_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    concept_ids: Mapped[Optional[List[UUID]]] = mapped_column(
        ARRAY(PG_UUID(as_uuid=True)), nullable=True
    )
    render_kind: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    render_payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)


class QuizSession(Base):
    __tablename__ = "quiz_sessions"
    __table_args__ = (
        Index("idx_quiz_sessions_user_id", "user_id"),
        Index("idx_quiz_sessions_document_id", "document_id"),
        CheckConstraint(
            "difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])",
            name="quiz_sessions_difficulty_check",
        ),
        CheckConstraint(
            "status = ANY (ARRAY['active'::text, 'completed'::text, 'abandoned'::text])",
            name="quiz_sessions_status_check",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        server_default=func.gen_random_uuid(),
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        nullable=False,
    )
    document_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    difficulty: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default=text("'medium'::text"),
    )
    status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default=text("'active'::text"),
    )
    total_questions: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        server_default=text("0"),
    )
    correct_answers: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        server_default=text("0"),
    )
    score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    answered_questions: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        server_default=text("0"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Chunk(Base):
    __tablename__ = "chunks"
    __table_args__ = (Index("idx_chunks_document_id", "document_id"),)

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        server_default=func.gen_random_uuid(),
    )
    document_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    chunk_metadata: Mapped[Optional[dict]] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
        server_default=text("'{}'::jsonb"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class UserDailyUsage(Base):
    __tablename__ = "user_daily_usage"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("auth.users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    sprints_used: Mapped[int] = mapped_column(
        Integer, server_default=text("0"), nullable=False
    )
    quizzes_used: Mapped[int] = mapped_column(
        Integer, server_default=text("0"), nullable=False
    )
    extra_quizzes: Mapped[int] = mapped_column(
        Integer, server_default=text("0"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
