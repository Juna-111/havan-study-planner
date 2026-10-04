"""add student-controlled Havan Today/Week/Month planner

Revision ID: 20261004_01
Revises: 20261003_02
Create Date: 2026-10-04
"""

from alembic import op
import sqlalchemy as sa

revision = "20261004_01"
down_revision = "20261003_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "havan_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mode", sa.String(length=10), nullable=False),
        sa.Column("horizon_days", sa.Integer(), nullable=False),
        sa.Column("study_days", sa.String(length=50), nullable=False, server_default=""),
        sa.Column("hours_per_day_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("total_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("student_id", "id", name="uq_havan_plans_student_id"),
    )
    op.create_index("ix_havan_plans_student_id", "havan_plans", ["student_id"])

    op.create_table(
        "havan_plan_selections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("havan_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("topic_id", sa.Integer(), sa.ForeignKey("topics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_minutes", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_havan_plan_selections_plan_id", "havan_plan_selections", ["plan_id"])

    op.create_table(
        "havan_plan_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("havan_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("topic_id", sa.Integer(), sa.ForeignKey("topics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("planned_date", sa.Date(), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("academy_video_url", sa.Text(), nullable=True),
        sa.Column("academy_notes_url", sa.Text(), nullable=True),
        sa.Column("academy_questions_url", sa.Text(), nullable=True),
        sa.Column("freshman_question_count", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PLANNED"),
    )
    op.create_index("ix_havan_plan_tasks_plan_id", "havan_plan_tasks", ["plan_id"])
    op.create_index("ix_havan_plan_tasks_planned_date", "havan_plan_tasks", ["planned_date"])


def downgrade() -> None:
    op.drop_index("ix_havan_plan_tasks_planned_date", table_name="havan_plan_tasks")
    op.drop_index("ix_havan_plan_tasks_plan_id", table_name="havan_plan_tasks")
    op.drop_table("havan_plan_tasks")
    op.drop_index("ix_havan_plan_selections_plan_id", table_name="havan_plan_selections")
    op.drop_table("havan_plan_selections")
    op.drop_index("ix_havan_plans_student_id", table_name="havan_plans")
    op.drop_table("havan_plans")
