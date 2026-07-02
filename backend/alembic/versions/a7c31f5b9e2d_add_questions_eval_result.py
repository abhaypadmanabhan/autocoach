"""add questions.eval_result

Revision ID: a7c31f5b9e2d
Revises: b5ca81274669
Create Date: 2026-07-01

Adds questions.eval_result JSONB (nullable). Written by the async free-text
eval pipeline (#22): once graded it stores {"feedback", "mastery_delta",
"xp_awarded"} so the verdict long-poll can return the real tutor feedback and
mastery delta; while pending it carries the self-heal "attempts" counter used
by the stale-eval backoff (fail-closed after 3 attempts).

Idempotent (IF NOT EXISTS / IF EXISTS) so it is safe on fresh and
already-patched databases.
"""

from typing import Sequence, Union

from alembic import op


revision: str = "a7c31f5b9e2d"
down_revision: Union[str, None] = "b5ca81274669"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE questions ADD COLUMN IF NOT EXISTS eval_result JSONB")


def downgrade() -> None:
    op.execute("ALTER TABLE questions DROP COLUMN IF EXISTS eval_result")
