"""add study progress totals

Revision ID: 20261001_05
Revises: 20261001_04
"""

from alembic import op
import sqlalchemy as sa

revision = "20261001_05"
down_revision = "20261001_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "student_topic_progress",
        sa.Column("completed_minutes", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "student_topic_progress",
        sa.Column("study_sessions", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("student_topic_progress", "study_sessions")
    op.drop_column("student_topic_progress", "completed_minutes")
