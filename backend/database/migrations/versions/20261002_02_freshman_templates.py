"""add versioned freshman curriculum templates

Revision ID: 20261002_02
Revises: 20261002_01
Create Date: 2026-10-02
"""

from alembic import op
import sqlalchemy as sa


revision = "20261002_02"
down_revision = "20261002_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "freshman_curriculum_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("version", sa.String(length=30), nullable=False),
        sa.Column("academic_year", sa.String(length=30), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="DRAFT"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("code", "version", name="uq_freshman_templates_code_version"),
    )
    op.create_index("ix_freshman_templates_code", "freshman_curriculum_templates", ["code"])
    op.create_index("ix_freshman_templates_status", "freshman_curriculum_templates", ["status"])

    op.create_table(
        "freshman_template_semesters",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("template_id", sa.Integer(), sa.ForeignKey("freshman_curriculum_templates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("semester_number", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.UniqueConstraint("template_id", "semester_number", name="uq_freshman_template_semester"),
        sa.CheckConstraint("semester_number IN (1, 2)", name="ck_freshman_template_semester_number"),
    )
    op.create_index("ix_freshman_template_semesters_template", "freshman_template_semesters", ["template_id"])

    op.create_table(
        "freshman_template_courses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("semester_id", sa.Integer(), sa.ForeignKey("freshman_template_semesters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requirement_type", sa.String(length=20), nullable=False, server_default="REQUIRED"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.UniqueConstraint("semester_id", "course_id", name="uq_freshman_template_semester_course"),
        sa.CheckConstraint("requirement_type IN ('REQUIRED', 'ELECTIVE')", name="ck_freshman_template_course_requirement"),
        sa.CheckConstraint("order_index >= 1", name="ck_freshman_template_course_order"),
    )
    op.create_index("ix_freshman_template_courses_semester", "freshman_template_courses", ["semester_id"])
    op.create_index("ix_freshman_template_courses_course", "freshman_template_courses", ["course_id"])


def downgrade() -> None:
    op.drop_index("ix_freshman_template_courses_course", table_name="freshman_template_courses")
    op.drop_index("ix_freshman_template_courses_semester", table_name="freshman_template_courses")
    op.drop_table("freshman_template_courses")
    op.drop_index("ix_freshman_template_semesters_template", table_name="freshman_template_semesters")
    op.drop_table("freshman_template_semesters")
    op.drop_index("ix_freshman_templates_status", table_name="freshman_curriculum_templates")
    op.drop_index("ix_freshman_templates_code", table_name="freshman_curriculum_templates")
    op.drop_table("freshman_curriculum_templates")
