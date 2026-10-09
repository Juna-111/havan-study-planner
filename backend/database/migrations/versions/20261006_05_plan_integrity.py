"""Restore model defaults and add Plan integrity indexes.

Revision ID: 20261006_05
Revises: 20261006_04
"""

from alembic import op
import sqlalchemy as sa

revision = "20261006_05"
down_revision = "20261006_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("student_accounts"):
        with op.batch_alter_table("student_accounts") as batch_op:
            batch_op.alter_column("role", existing_type=sa.String(length=10), server_default="STUDENT")

    if inspector.has_table("plans"):
        indexes = {item["name"] for item in inspector.get_indexes("plans")}
        if "uq_plans_one_active_per_student" not in indexes:
            op.create_index(
                "uq_plans_one_active_per_student",
                "plans",
                ["student_id"],
                unique=True,
                postgresql_where=sa.text("status = 'ACTIVE'"),
            )
        plan_task_indexes = {item["name"] for item in inspector.get_indexes("plan_tasks")}
        if "ix_plan_tasks_plan_date" not in plan_task_indexes:
            op.create_index(
                "ix_plan_tasks_plan_date",
                "plan_tasks",
                ["plan_id", "planned_date"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("plans"):
        indexes = {item["name"] for item in inspector.get_indexes("plans")}
        if "ix_plan_tasks_plan_date" in {item["name"] for item in inspector.get_indexes("plan_tasks")}:
            op.drop_index("ix_plan_tasks_plan_date", table_name="plan_tasks")
        if "uq_plans_one_active_per_student" in indexes:
            op.drop_index("uq_plans_one_active_per_student", table_name="plans")
