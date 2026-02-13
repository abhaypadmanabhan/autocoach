"""Add user_daily_usage table

Revision ID: 2e66f7a2ef8b
Revises: a1f3c2b9e7d1
Create Date: 2026-02-13 15:25:05.181047

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2e66f7a2ef8b'
down_revision: Union[str, None] = 'a1f3c2b9e7d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_daily_usage',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('sprints_used', sa.Integer(), server_default='0', nullable=False),
        sa.Column('quizzes_used', sa.Integer(), server_default='0', nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('user_id', 'date'),
        sa.ForeignKeyConstraint(['user_id'], ['auth.users.id'], ondelete='CASCADE')
    )


def downgrade() -> None:
    op.drop_table('user_daily_usage')
