"""add deterministic study planner

Revision ID: 20261001_03
Revises: 20261001_02
Create Date: 2026-10-01
"""

from alembic import op
import sqlalchemy as sa

revision = "20261001_03"
down_revision = "20261001_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "study_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("horizon_days", sa.Integer(), server_default="7", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_study_plans_student_id", "study_plans", ["student_id"])

    op.create_table(
        "study_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("study_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("topic_id", sa.Integer(), sa.ForeignKey("topics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("planned_date", sa.Date(), nullable=False),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False),
        sa.Column("priority", sa.Float(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="RECOMMENDED", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_study_tasks_plan_id", "study_tasks", ["plan_id"])
    op.create_index("ix_study_tasks_student_id", "study_tasks", ["student_id"])
    op.create_index("ix_study_tasks_planned_date", "study_tasks", ["planned_date"])


def downgrade() -> None:
    op.drop_table("study_tasks")
    op.drop_index("ix_study_plans_student_id", table_name="study_plans")
    op.drop_table("study_plans")
