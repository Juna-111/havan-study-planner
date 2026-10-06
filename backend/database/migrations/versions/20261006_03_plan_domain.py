"""Create the canonical Plan-domain tables.

Revision ID: 20261006_03
Revises: 20261006_02
"""

from alembic import op
import sqlalchemy as sa

revision = "20261006_03"
down_revision = "20261006_02"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("mode", sa.String(length=10), nullable=False),
        sa.Column("horizon_days", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("engine_version", sa.String(length=20), nullable=False),
        sa.Column("total_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("readiness", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("warnings", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("unplaced", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("input_snapshot", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_plans_student_id", "plans", ["student_id"])

    op.create_table(
        "plan_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("topic_id", sa.Integer(), sa.ForeignKey("topics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("planned_date", sa.Date(), nullable=False, index=True),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("priority", sa.Float(), nullable=False, server_default="0"),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("reason_parts", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("kind", sa.String(length=10), nullable=False, server_default="STUDY"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PLANNED"),
        sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("actual_minutes", sa.Integer()),
        sa.Column("confidence", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_plan_tasks_plan_id", "plan_tasks", ["plan_id"])
    op.create_index("ix_plan_tasks_student_id", "plan_tasks", ["student_id"])
    op.create_index("ix_plan_tasks_planned_date", "plan_tasks", ["planned_date"])


def downgrade():
    op.drop_index("ix_plan_tasks_planned_date", table_name="plan_tasks")
    op.drop_index("ix_plan_tasks_student_id", table_name="plan_tasks")
    op.drop_index("ix_plan_tasks_plan_id", table_name="plan_tasks")
    op.drop_table("plan_tasks")
    op.drop_index("ix_plans_student_id", table_name="plans")
    op.drop_table("plans")
