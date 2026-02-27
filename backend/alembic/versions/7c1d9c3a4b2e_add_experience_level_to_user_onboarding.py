"""add_experience_level_to_user_onboarding

Revision ID: 7c1d9c3a4b2e
Revises: c5f3203596fd
Create Date: 2026-02-27 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7c1d9c3a4b2e"
down_revision: Union[str, None] = "c5f3203596fd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_onboarding",
        sa.Column("experience_level", sa.Text(), nullable=True),
    )

    op.execute(
        """
        UPDATE user_onboarding
        SET experience_level = 'beginner'
        WHERE experience_level IS NULL
        """
    )

    op.alter_column(
        "user_onboarding",
        "experience_level",
        server_default=sa.text("'beginner'"),
        existing_type=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.drop_column("user_onboarding", "experience_level")
