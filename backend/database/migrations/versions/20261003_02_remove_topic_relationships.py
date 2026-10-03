"""remove the deprecated topic relationship system

Revision ID: 20261003_02
Revises: 20261003_01
Create Date: 2026-10-03
"""

from alembic import op

revision = "20261003_02"
down_revision = "20261003_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_topic_relationships_target", table_name="topic_relationships")
    op.drop_index("ix_topic_relationships_source", table_name="topic_relationships")
    op.drop_table("topic_relationships")


def downgrade() -> None:
    raise RuntimeError(
        "The topic relationship system was intentionally removed from Havan. "
        "Restore it from version control before attempting a downgrade."
    )
