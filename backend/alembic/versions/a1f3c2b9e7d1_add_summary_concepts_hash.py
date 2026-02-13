"""Add summary_concepts_hash to documents table

Revision ID: a1f3c2b9e7d1
Revises: d912e847
Create Date: 2026-02-12 23:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1f3c2b9e7d1"
down_revision: Union[str, None] = "d912e847"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "documents", sa.Column("summary_concepts_hash", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("documents", "summary_concepts_hash")
