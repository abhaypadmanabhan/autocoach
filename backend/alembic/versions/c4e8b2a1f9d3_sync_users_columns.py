"""sync live users columns

Revision ID: c4e8b2a1f9d3
Revises: f3a9c1e7b2d4
Create Date: 2026-07-08

Adds columns present on live Supabase `users` but missing from a from-scratch
alembic rebuild: plan_type (new), plus idempotent guards for email,
full_name, avatar_url, total_xp (already created by 573f6db13c30).

Idempotent (IF NOT EXISTS / IF EXISTS) so it is safe on fresh and
already-patched databases (#31).
"""

from typing import Sequence, Union

from alembic import op


revision: str = "c4e8b2a1f9d3"
down_revision: Union[str, None] = "f3a9c1e7b2d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_type "
        "TEXT NOT NULL DEFAULT 'free'"
    )
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT")
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS total_xp "
        "INTEGER NOT NULL DEFAULT 0"
    )


def downgrade() -> None:
    # Only drop plan_type — the other four are owned by 573f6db13c30.
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS plan_type")
