"""Add User model and fix metadata

Revision ID: 573f6db13c30
Revises: 361a250772af
Create Date: 2026-02-06 22:34:08.855711

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '573f6db13c30'
down_revision: Union[str, None] = '361a250772af'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    op.create_table('users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.Text(), nullable=True),
        sa.Column('full_name', sa.Text(), nullable=True),
        sa.Column('avatar_url', sa.Text(), nullable=True),
        sa.Column('streak_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('last_sprint_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_xp', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['id'], ['auth.users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('users')
