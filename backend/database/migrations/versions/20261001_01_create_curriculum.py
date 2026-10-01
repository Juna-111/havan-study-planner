"""create curriculum and topic relationship tables

Revision ID: 20261001_01
Revises:
Create Date: 2026-10-01
"""

from alembic import op
import sqlalchemy as sa

revision = "20261001_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "universities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="ACTIVE", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("code", name="uq_universities_code"),
    )
    op.create_index("ix_universities_name", "universities", ["name"])

    op.create_table(
        "curriculums",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("university_id", sa.Integer(), sa.ForeignKey("universities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("academic_year", sa.String(length=30), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="DRAFT", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("university_id", "name", "version", name="uq_curriculums_university_name_version"),
    )
    op.create_index("ix_curriculums_university_id", "curriculums", ["university_id"])

    op.create_table(
        "streams",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("curriculum_id", sa.Integer(), sa.ForeignKey("curriculums.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="ACTIVE", nullable=False),
        sa.UniqueConstraint("curriculum_id", "code", name="uq_streams_curriculum_code"),
    )
    op.create_index("ix_streams_curriculum_id", "streams", ["curriculum_id"])

    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("stream_id", sa.Integer(), sa.ForeignKey("streams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("credit_hours", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="ACTIVE", nullable=False),
        sa.UniqueConstraint("stream_id", "code", name="uq_courses_stream_code"),
        sa.CheckConstraint("credit_hours >= 0", name="ck_courses_credit_hours_nonnegative"),
    )
    op.create_index("ix_courses_stream_id", "courses", ["stream_id"])
    op.create_index("ix_courses_name", "courses", ["name"])

    op.create_table(
        "chapters",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="ACTIVE", nullable=False),
        sa.UniqueConstraint("course_id", "order_index", name="uq_chapters_course_order"),
    )
    op.create_index("ix_chapters_course_id", "chapters", ["course_id"])

    op.create_table(
        "topics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("chapter_id", sa.Integer(), sa.ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=250), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("difficulty", sa.Integer(), server_default="3", nullable=False),
        sa.Column("estimated_study_minutes", sa.Integer(), server_default="60", nullable=False),
        sa.Column("exam_importance", sa.Float(), server_default="0.5", nullable=False),
        sa.Column("conceptual_importance", sa.Float(), server_default="0.5", nullable=False),
        sa.Column("order_index", sa.Integer(), server_default="1", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="ACTIVE", nullable=False),
        sa.UniqueConstraint("chapter_id", "name", name="uq_topics_chapter_name"),
        sa.CheckConstraint("difficulty BETWEEN 1 AND 5", name="ck_topics_difficulty_range"),
        sa.CheckConstraint("estimated_study_minutes > 0", name="ck_topics_study_minutes_positive"),
        sa.CheckConstraint("exam_importance BETWEEN 0 AND 1", name="ck_topics_exam_importance_range"),
        sa.CheckConstraint("conceptual_importance BETWEEN 0 AND 1", name="ck_topics_conceptual_importance_range"),
    )
    op.create_index("ix_topics_chapter_id", "topics", ["chapter_id"])
    op.create_index("ix_topics_name", "topics", ["name"])

    op.create_table(
        "topic_relationships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_topic_id", sa.Integer(), sa.ForeignKey("topics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_topic_id", sa.Integer(), sa.ForeignKey("topics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relationship_type", sa.String(length=30), nullable=False),
        sa.Column("strength", sa.Float(), server_default="1.0", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.UniqueConstraint("source_topic_id", "target_topic_id", "relationship_type", name="uq_topic_relationship"),
        sa.CheckConstraint("source_topic_id <> target_topic_id", name="ck_topic_relationships_not_self"),
        sa.CheckConstraint("strength BETWEEN 0 AND 1", name="ck_topic_relationships_strength_range"),
    )
    op.create_index("ix_topic_relationships_source", "topic_relationships", ["source_topic_id"])
    op.create_index("ix_topic_relationships_target", "topic_relationships", ["target_topic_id"])


def downgrade() -> None:
    op.drop_index("ix_topic_relationships_target", table_name="topic_relationships")
    op.drop_index("ix_topic_relationships_source", table_name="topic_relationships")
    op.drop_table("topic_relationships")
    op.drop_index("ix_topics_name", table_name="topics")
    op.drop_index("ix_topics_chapter_id", table_name="topics")
    op.drop_table("topics")
    op.drop_index("ix_chapters_course_id", table_name="chapters")
    op.drop_table("chapters")
    op.drop_index("ix_courses_name", table_name="courses")
    op.drop_index("ix_courses_stream_id", table_name="courses")
    op.drop_table("courses")
    op.drop_index("ix_streams_curriculum_id", table_name="streams")
    op.drop_table("streams")
    op.drop_index("ix_curriculums_university_id", table_name="curriculums")
    op.drop_table("curriculums")
    op.drop_index("ix_universities_name", table_name="universities")
    op.drop_table("universities")
