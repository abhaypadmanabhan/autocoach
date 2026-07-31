"""add user_onboarding.updated_at so the BEFORE UPDATE trigger can fire

The table carries a `trg_user_onboarding_updated_at` BEFORE UPDATE trigger
running `set_updated_at()`, which assigns `new.updated_at`. The column was
never created, so every UPDATE on the table failed with:

    record "new" has no field "updated_at"   (SQLSTATE 42703)

Inserts never fire a BEFORE UPDATE trigger, so first-time onboarding always
worked and every *re-save* — including "redo onboarding" — always failed. The
route swallowed the driver error into a generic 500, which is why it went
unnoticed until a device run.

Adding the column is the smaller fix: it keeps the trigger's intent (documents
already has the same trigger and column pair) rather than dropping auditing
from one table. Additive and idempotent.

Revision ID: a1c7f4d2e8b9
Revises: c4e8b2a1f9d3
Create Date: 2026-07-30
"""

from typing import Sequence, Union

from alembic import op

revision: str = "a1c7f4d2e8b9"
down_revision: Union[str, None] = "c4e8b2a1f9d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # IF NOT EXISTS: safe to re-run, and safe if the column was hotfixed by hand.
    op.execute(
        "ALTER TABLE public.user_onboarding "
        "ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()"
    )
    # Existing rows get now() from the default; backfill from completed_at so the
    # column reflects when the row was actually last written, not when it was patched.
    op.execute(
        "UPDATE public.user_onboarding "
        "SET updated_at = completed_at "
        "WHERE completed_at IS NOT NULL AND updated_at > completed_at"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE public.user_onboarding DROP COLUMN IF EXISTS updated_at")
