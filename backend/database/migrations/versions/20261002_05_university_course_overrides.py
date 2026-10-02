"""add university curriculum overrides and exceptions

Revision ID: 20261002_05
Revises: 20261002_04
Create Date: 2026-10-02
"""

from alembic import op
import sqlalchemy as sa


revision = "20261002_05"
down_revision = "20261002_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "university_course_overrides",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("curriculum_id", sa.Integer(), sa.ForeignKey("curriculums.id", ondelete="CASCADE"), nullable=False),
        sa.Column("national_course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("local_course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("source_stream_id", sa.Integer(), sa.ForeignKey("streams.id", ondelete="CASCADE"), nullable=True),
        sa.Column("target_stream_id", sa.Integer(), sa.ForeignKey("streams.id", ondelete="CASCADE"), nullable=True),
        sa.Column("override_type", sa.String(length=20), nullable=False),
        sa.Column("semester_number", sa.Integer(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=True),
        sa.Column("local_code", sa.String(length=40), nullable=True),
        sa.Column("local_title", sa.String(length=150), nullable=True),
        sa.Column("local_credit_hours", sa.Integer(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="DRAFT"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "override_type IN ('ADD', 'REMOVE', 'MOVE', 'CHANGE_STREAM', 'METADATA')",
            name="ck_university_course_override_type",
        ),
        sa.CheckConstraint(
            "status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')",
            name="ck_university_course_override_status",
        ),
        sa.CheckConstraint(
            "semester_number IS NULL OR semester_number IN (1, 2)",
            name="ck_university_course_override_semester",
        ),
        sa.CheckConstraint(
            "order_index IS NULL OR order_index >= 1",
            name="ck_university_course_override_order",
        ),
    )
    op.create_index("ix_university_course_overrides_curriculum", "university_course_overrides", ["curriculum_id"])
    op.create_index("ix_university_course_overrides_national_course", "university_course_overrides", ["national_course_id"])
    op.create_index("ix_university_course_overrides_local_course", "university_course_overrides", ["local_course_id"])
    op.create_index("ix_university_course_overrides_target_stream", "university_course_overrides", ["target_stream_id"])


def downgrade() -> None:
    op.drop_index("ix_university_course_overrides_target_stream", table_name="university_course_overrides")
    op.drop_index("ix_university_course_overrides_local_course", table_name="university_course_overrides")
    op.drop_index("ix_university_course_overrides_national_course", table_name="university_course_overrides")
    op.drop_index("ix_university_course_overrides_curriculum", table_name="university_course_overrides")
    op.drop_table("university_course_overrides")
