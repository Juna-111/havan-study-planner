"""Add explicit topic scope to student exams.

Revision ID: 20261007_07
Revises: 20261006_06
"""

from alembic import op
import sqlalchemy as sa

revision = "20261007_07"
down_revision = "20261006_06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "student_exams" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("student_exams")}
    if "selected_topic_ids" not in columns:
        op.add_column(
            "student_exams",
            sa.Column("selected_topic_ids", sa.JSON(), nullable=False, server_default="[]"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "student_exams" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("student_exams")}
        if "selected_topic_ids" in columns:
            op.drop_column("student_exams", "selected_topic_ids")
