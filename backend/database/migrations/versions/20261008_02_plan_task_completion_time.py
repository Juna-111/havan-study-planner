"""Record actual plan task completion timestamps.

Revision ID: 20261008_02
Revises: 20261008_01
"""

from alembic import op
import sqlalchemy as sa

revision = "20261008_02"
down_revision = "20261008_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "plan_tasks",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("plan_tasks", "completed_at")
