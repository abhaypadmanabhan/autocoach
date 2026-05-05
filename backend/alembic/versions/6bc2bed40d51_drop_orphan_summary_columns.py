"""drop orphan summary columns from documents

Revision ID: 6bc2bed40d51
Revises: 6e3be108bedc
Create Date: 2026-05-05

The /documents/{id}/summary endpoint and the summary_generator service were
removed in PR1; these columns are no longer read or written. Dropping them
to keep the schema honest. The daily_sprints table is intentionally not
dropped here — leaving it orphan in DB for now (zero data risk; drop in
a follow-up migration once we are sure no historical data is needed).

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "6bc2bed40d51"
down_revision: Union[str, None] = "6e3be108bedc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("documents", "summary_concepts_hash")
    op.drop_column("documents", "summary_version")
    op.drop_column("documents", "summary_generated_at")
    op.drop_column("documents", "summary_json")


def downgrade() -> None:
    # Restoring the columns; existing data is not recoverable since the
    # service that populated them was deleted.
    op.add_column(
        "documents",
        sa.Column(
            "summary_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True
        ),
    )
    op.add_column(
        "documents",
        sa.Column("summary_generated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("documents", sa.Column("summary_version", sa.Text(), nullable=True))
    op.add_column(
        "documents", sa.Column("summary_concepts_hash", sa.Text(), nullable=True)
    )
