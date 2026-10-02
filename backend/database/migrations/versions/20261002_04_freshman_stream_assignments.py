"""assign national Freshman courses to university streams

Revision ID: 20261002_04
Revises: 20261002_03
Create Date: 2026-10-02
"""

from alembic import op
import sqlalchemy as sa


revision = "20261002_04"
down_revision = "20261002_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "freshman_stream_course_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "stream_id",
            sa.Integer(),
            sa.ForeignKey("streams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "template_course_id",
            sa.Integer(),
            sa.ForeignKey("freshman_template_courses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="DRAFT"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint(
            "stream_id",
            "template_course_id",
            name="uq_freshman_stream_template_course",
        ),
        sa.CheckConstraint(
            "status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')",
            name="ck_freshman_stream_assignment_status",
        ),
    )
    op.create_index(
        "ix_freshman_stream_assignment_stream",
        "freshman_stream_course_assignments",
        ["stream_id"],
    )
    op.create_index(
        "ix_freshman_stream_assignment_template_course",
        "freshman_stream_course_assignments",
        ["template_course_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_freshman_stream_assignment_template_course",
        table_name="freshman_stream_course_assignments",
    )
    op.drop_index(
        "ix_freshman_stream_assignment_stream",
        table_name="freshman_stream_course_assignments",
    )
    op.drop_table("freshman_stream_course_assignments")
