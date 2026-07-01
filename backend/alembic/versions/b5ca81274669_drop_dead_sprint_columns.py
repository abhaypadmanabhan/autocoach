"""drop dead sprint-era schema

Revision ID: b5ca81274669
Revises: b3e7a1f9c2d4
Create Date: 2026-07-01

Drops the orphan daily_sprints table and dead columns no longer referenced by
the backend. question render_kind/render_payload are intentionally retained for
Phase 2 rendered-question support.
"""

from typing import Sequence, Union

from alembic import op


revision: str = "b5ca81274669"
down_revision: Union[str, None] = "b3e7a1f9c2d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS daily_sprints")
    op.execute("ALTER TABLE quiz_sessions DROP COLUMN IF EXISTS score")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS streak_count")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS last_sprint_date")
    op.execute("ALTER TABLE chunks DROP COLUMN IF EXISTS page_number")


def downgrade() -> None:
    op.execute(
        "ALTER TABLE chunks ADD COLUMN IF NOT EXISTS page_number INTEGER"
    )
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sprint_date "
        "TIMESTAMP WITH TIME ZONE"
    )
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_count "
        "INTEGER NOT NULL DEFAULT 0"
    )
    op.execute(
        "ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS score NUMERIC(5, 2)"
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS daily_sprints (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            sprint_date DATE NOT NULL,
            document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
            target_concepts UUID[],
            num_questions INTEGER NOT NULL DEFAULT 5,
            completed_questions INTEGER NOT NULL DEFAULT 0,
            xp_earned INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        )
        """
    )
