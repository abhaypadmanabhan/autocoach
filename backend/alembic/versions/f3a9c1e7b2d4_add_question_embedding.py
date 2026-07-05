"""add questions.question_embedding

Revision ID: f3a9c1e7b2d4
Revises: a7c31f5b9e2d
Create Date: 2026-07-04

Adds questions.question_embedding JSONB (nullable): the OpenAI
text-embedding-3-small (1536-dim) vector of the question text, stored as a JSON
array of floats. Used by the semantic dedup guard (#23) — the generator
compares a freshly generated question against the last N questions in the
session (cosine > 0.85) and retries once on a near-duplicate.

Stored as JSONB rather than pgvector: the comparison happens in Python over a
tiny window (last 3 questions), so no ANN index / vector operators are needed,
and this avoids a pgvector extension dependency (all ANN vectors live in
Qdrant, not Postgres).

Idempotent (IF NOT EXISTS / IF EXISTS) so it is safe on fresh and
already-patched databases.
"""

from typing import Sequence, Union

from alembic import op


revision: str = "f3a9c1e7b2d4"
down_revision: Union[str, None] = "a7c31f5b9e2d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_embedding JSONB")


def downgrade() -> None:
    op.execute("ALTER TABLE questions DROP COLUMN IF EXISTS question_embedding")
