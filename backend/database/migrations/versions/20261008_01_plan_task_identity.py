"""Enforce unique persisted study task identity.

Revision ID: 20261008_01
Revises: 20261007_09
"""

from alembic import op
import sqlalchemy as sa

revision = "20261008_01"
down_revision = "20261007_09"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(sa.text("""
            DELETE FROM plan_tasks
            WHERE id IN (
                SELECT id
                FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY plan_id, topic_id, planned_date, kind
                               ORDER BY
                                   CASE WHEN status = 'DONE' THEN 0 ELSE 1 END,
                                   id
                           ) AS row_number
                    FROM plan_tasks
                ) duplicates
                WHERE row_number > 1
            )
        """))
    inspector = sa.inspect(bind)
    constraints = {
        item["name"]
        for item in inspector.get_unique_constraints("plan_tasks")
    }
    if "uq_plan_tasks_plan_topic_date_kind" not in constraints:
        op.create_unique_constraint(
            "uq_plan_tasks_plan_topic_date_kind",
            "plan_tasks",
            ["plan_id", "topic_id", "planned_date", "kind"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    constraints = {
        item["name"]
        for item in inspector.get_unique_constraints("plan_tasks")
    }
    if "uq_plan_tasks_plan_topic_date_kind" in constraints:
        op.drop_constraint(
            "uq_plan_tasks_plan_topic_date_kind",
            "plan_tasks",
            type_="unique",
        )
