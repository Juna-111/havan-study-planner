"""Introduce offering-based university course assignments.

Revision ID: 20261009_01
Revises: 20261008_02
Create Date: 2026-10-09
"""

from alembic import op
import sqlalchemy as sa


revision = "20261009_01"
down_revision = "20261008_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "university_course_offerings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("curriculum_id", sa.Integer(), sa.ForeignKey("curriculums.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stream_id", sa.Integer(), sa.ForeignKey("streams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("semester_number", sa.Integer(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="DRAFT"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("stream_id", "course_id", name="uq_university_course_offering_stream_course"),
        sa.CheckConstraint("semester_number IN (1, 2)", name="ck_university_course_offering_semester"),
        sa.CheckConstraint("order_index >= 1", name="ck_university_course_offering_order"),
        sa.CheckConstraint("status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')", name="ck_university_course_offering_status"),
    )
    op.create_index("ix_university_course_offering_curriculum", "university_course_offerings", ["curriculum_id"])
    op.create_index("ix_university_course_offering_stream", "university_course_offerings", ["stream_id"])
    op.create_index("ix_university_course_offering_course", "university_course_offerings", ["course_id"])

    # Preserve every existing assignment when the canonical table is introduced.
    op.execute(
        sa.text(
            """
            INSERT INTO university_course_offerings (
                curriculum_id, stream_id, course_id, semester_number,
                order_index, status, created_at, updated_at
            )
            SELECT
                curriculum_id, stream_id, course_id, semester_number,
                order_index, status, created_at, updated_at
            FROM university_course_mappings
            """
        )
    )


def downgrade() -> None:
    op.drop_index("ix_university_course_offering_course", table_name="university_course_offerings")
    op.drop_index("ix_university_course_offering_stream", table_name="university_course_offerings")
    op.drop_index("ix_university_course_offering_curriculum", table_name="university_course_offerings")
    op.drop_table("university_course_offerings")
