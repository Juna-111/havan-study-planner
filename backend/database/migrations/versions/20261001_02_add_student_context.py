"""add student planning context

Revision ID: 20261001_02
Revises: 20261001_01
Create Date: 2026-10-01
"""

from alembic import op
import sqlalchemy as sa

revision = "20261001_02"
down_revision = "20261001_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "student_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("client_key", sa.String(length=120), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("university_id", sa.Integer(), sa.ForeignKey("universities.id"), nullable=False),
        sa.Column("curriculum_id", sa.Integer(), sa.ForeignKey("curriculums.id"), nullable=False),
        sa.Column("stream_id", sa.Integer(), sa.ForeignKey("streams.id"), nullable=False),
        sa.Column("study_hours_per_day", sa.Float(), server_default="2", nullable=False),
        sa.Column("study_days", sa.JSON(), server_default="[]", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("client_key", name="uq_student_profiles_client_key"),
    )

    op.create_table(
        "student_courses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("confidence", sa.Integer(), server_default="3", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="ACTIVE", nullable=False),
        sa.UniqueConstraint("student_id", "course_id", name="uq_student_course"),
    )

    op.create_table(
        "student_topic_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("topic_id", sa.Integer(), sa.ForeignKey("topics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="NOT_STARTED", nullable=False),
        sa.Column("confidence", sa.Integer(), server_default="3", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("last_studied_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("student_id", "topic_id", name="uq_student_topic_progress"),
    )

    op.create_table(
        "student_exams",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("exam_type", sa.String(length=30), nullable=False),
        sa.Column("exam_date", sa.Date(), nullable=False),
        sa.Column("importance", sa.Integer(), server_default="3", nullable=False),
        sa.UniqueConstraint("student_id", "course_id", "exam_type", "exam_date", name="uq_student_exam"),
    )


def downgrade() -> None:
    op.drop_table("student_exams")
    op.drop_table("student_topic_progress")
    op.drop_table("student_courses")
    op.drop_table("student_profiles")
