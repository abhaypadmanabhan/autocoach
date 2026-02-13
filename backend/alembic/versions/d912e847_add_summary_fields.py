"""Add summary fields to documents table

Revision ID: d912e847
Revises: 361a250772af
Create Date: 2026-02-12 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd912e847'
down_revision: Union[str, None] = '573f6db13c30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('documents', sa.Column('summary_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('documents', sa.Column('summary_generated_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('documents', sa.Column('summary_version', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('documents', 'summary_version')
    op.drop_column('documents', 'summary_generated_at')
    op.drop_column('documents', 'summary_json')
