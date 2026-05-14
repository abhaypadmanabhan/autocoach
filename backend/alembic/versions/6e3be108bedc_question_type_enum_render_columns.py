"""question_type enum + render columns

Revision ID: 6e3be108bedc
Revises: 7c1d9c3a4b2e
Create Date: 2026-05-04

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "6e3be108bedc"
down_revision: Union[str, None] = "7c1d9c3a4b2e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


QUESTION_TYPE_VALUES = ("text_free", "text_mcq", "text_tf", "rendered")


def upgrade() -> None:
    # Drop stale Supabase auto-named CHECK before backfilling new enum-name values.
    # Required on fresh DBs; idempotent on already-migrated DBs.
    op.execute(
        "ALTER TABLE questions "
        "DROP CONSTRAINT IF EXISTS questions_question_type_check"
    )

    # 1. Backfill old string values to new enum names BEFORE constraint
    op.execute(
        """
        UPDATE questions SET question_type = CASE question_type
          WHEN 'mcq'        THEN 'text_mcq'
          WHEN 'true_false' THEN 'text_tf'
          WHEN 'truefalse'  THEN 'text_tf'
          WHEN 'tf'         THEN 'text_tf'
          WHEN 'free_text'  THEN 'text_free'
          WHEN 'freetext'   THEN 'text_free'
          WHEN 'free'       THEN 'text_free'
          WHEN 'text'       THEN 'text_free'
          ELSE question_type
        END
        """
    )

    # 2. Create enum type and convert column
    question_type_enum = postgresql.ENUM(
        *QUESTION_TYPE_VALUES, name="question_type_enum"
    )
    question_type_enum.create(op.get_bind(), checkfirst=True)
    op.execute(
        "ALTER TABLE questions "
        "ALTER COLUMN question_type TYPE question_type_enum "
        "USING question_type::question_type_enum"
    )

    # 3. New nullable render columns (unused for now — wire up in a future PR)
    op.add_column(
        "questions", sa.Column("render_kind", sa.Text(), nullable=True)
    )
    op.add_column(
        "questions",
        sa.Column("render_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("questions", "render_payload")
    op.drop_column("questions", "render_kind")
    op.execute(
        "ALTER TABLE questions ALTER COLUMN question_type TYPE text USING question_type::text"
    )
    postgresql.ENUM(name="question_type_enum").drop(op.get_bind(), checkfirst=True)
