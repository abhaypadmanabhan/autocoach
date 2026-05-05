"""question_status lifecycle for async generation

Revision ID: 02968ade0f8e
Revises: 6bc2bed40d51
Create Date: 2026-05-05

Splits submit_answer's LLM call into a background task. Adds:
- question_status_enum: generating | ready | answered | failed
- questions.status (default 'ready' so existing rows keep working)
- questions.ready_at: timestamp set when generation completes
- questions.generation_attempts: small counter for retry bookkeeping
- partial-ish composite index for the /next lookup hot path
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "02968ade0f8e"
down_revision: Union[str, None] = "6bc2bed40d51"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


QUESTION_STATUS_VALUES = ("generating", "ready", "answered", "failed")


def upgrade() -> None:
    status_enum = postgresql.ENUM(
        *QUESTION_STATUS_VALUES, name="question_status_enum"
    )
    status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "questions",
        sa.Column(
            "status",
            sa.Enum(*QUESTION_STATUS_VALUES, name="question_status_enum"),
            nullable=False,
            server_default="ready",
        ),
    )
    op.add_column(
        "questions",
        sa.Column("ready_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "questions",
        sa.Column(
            "generation_attempts",
            sa.SmallInteger(),
            nullable=False,
            server_default="0",
        ),
    )

    # Backfill: any already-answered question is 'answered'; the rest stay 'ready'.
    op.execute(
        "UPDATE questions SET status='answered' WHERE user_answer IS NOT NULL"
    )

    op.create_index(
        "idx_questions_session_status_qnum",
        "questions",
        ["session_id", "status", "question_number"],
    )


def downgrade() -> None:
    op.drop_index("idx_questions_session_status_qnum", table_name="questions")
    op.drop_column("questions", "generation_attempts")
    op.drop_column("questions", "ready_at")
    op.drop_column("questions", "status")
    postgresql.ENUM(name="question_status_enum").drop(
        op.get_bind(), checkfirst=True
    )
