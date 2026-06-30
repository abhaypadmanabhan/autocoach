"""add quiz_sessions.session_type

Revision ID: b3e7a1f9c2d4
Revises: 02968ade0f8e
Create Date: 2026-06-30

Adds quiz_sessions.session_type ('standard' | 'review'). Drives the review
quota carve-out, the seeded concept selector, and future analytics. Defaults
to 'standard' so existing rows + the standard create path are unaffected.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3e7a1f9c2d4"
down_revision: Union[str, None] = "02968ade0f8e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "quiz_sessions",
        sa.Column(
            "session_type",
            sa.Text(),
            nullable=False,
            server_default="standard",
        ),
    )


def downgrade() -> None:
    op.drop_column("quiz_sessions", "session_type")
