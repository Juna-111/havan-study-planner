"""replace the legacy university mapping layers with direct semester course mappings

Revision ID: 20261003_01
Revises: 20261002_06
Create Date: 2026-10-03
"""

from alembic import op
import sqlalchemy as sa


revision = "20261003_01"
down_revision = "20261002_06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("university_course_overrides")
    op.drop_table("freshman_stream_course_assignments")
    op.drop_table("freshman_curriculum_mappings")
    op.drop_table("freshman_template_courses")
    op.drop_table("freshman_template_semesters")
    op.drop_table("freshman_curriculum_templates")

    op.create_table(
        "university_course_mappings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("curriculum_id", sa.Integer(), sa.ForeignKey("curriculums.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stream_id", sa.Integer(), sa.ForeignKey("streams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("semester_number", sa.Integer(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="DRAFT"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("stream_id", "course_id", name="uq_university_course_mapping_stream_course"),
        sa.CheckConstraint("semester_number IN (1, 2)", name="ck_university_course_mapping_semester"),
        sa.CheckConstraint("order_index >= 1", name="ck_university_course_mapping_order"),
        sa.CheckConstraint("status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')", name="ck_university_course_mapping_status"),
    )
    op.create_index("ix_university_course_mapping_curriculum", "university_course_mappings", ["curriculum_id"])
    op.create_index("ix_university_course_mapping_stream", "university_course_mappings", ["stream_id"])
    op.create_index("ix_university_course_mapping_course", "university_course_mappings", ["course_id"])


def downgrade() -> None:
    op.drop_index("ix_university_course_mapping_course", table_name="university_course_mappings")
    op.drop_index("ix_university_course_mapping_stream", table_name="university_course_mappings")
    op.drop_index("ix_university_course_mapping_curriculum", table_name="university_course_mappings")
    op.drop_table("university_course_mappings")
