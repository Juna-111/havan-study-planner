"""add reusable freshman academic course registry

Revision ID: 20261002_01
Revises: 20261001_merge_heads
Create Date: 2026-10-02
"""

from alembic import op
import sqlalchemy as sa


revision = "20261002_01"
down_revision = "20261001_merge_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("courses", sa.Column("academic_scope", sa.String(length=20), nullable=True))
    op.add_column("courses", sa.Column("registry_key", sa.String(length=120), nullable=True))
    op.add_column("courses", sa.Column("content_version", sa.String(length=30), nullable=True))

    # Existing courses are university-scoped. Give them stable registry identities
    # before making the new registry key mandatory.
    op.execute(
        sa.text(
            "UPDATE courses "
            "SET academic_scope = 'UNIVERSITY', "
            "registry_key = 'UNIVERSITY:' || stream_id || ':' || code, "
            "content_version = '1.0' "
            "WHERE academic_scope IS NULL"
        )
    )

    op.drop_constraint("uq_courses_stream_code", "courses", type_="unique")
    op.alter_column("courses", "stream_id", existing_type=sa.Integer(), nullable=True)
    op.alter_column("courses", "academic_scope", existing_type=sa.String(length=20), nullable=False, server_default="UNIVERSITY")
    op.alter_column("courses", "registry_key", existing_type=sa.String(length=120), nullable=False)
    op.alter_column("courses", "content_version", existing_type=sa.String(length=30), nullable=False, server_default="1.0")

    op.create_unique_constraint("uq_courses_registry_key", "courses", ["registry_key"])
    op.create_index("ix_courses_academic_scope", "courses", ["academic_scope"])

    op.create_table(
        "freshman_course_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("code", name="uq_freshman_course_categories_code"),
        sa.UniqueConstraint("name", name="uq_freshman_course_categories_name"),
    )

    op.create_table(
        "freshman_course_category_links",
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("freshman_course_categories.id", ondelete="CASCADE"), nullable=False),
        sa.PrimaryKeyConstraint("course_id", "category_id"),
    )
    op.create_index("ix_freshman_course_category_links_category", "freshman_course_category_links", ["category_id"])

    op.bulk_insert(
        sa.table(
            "freshman_course_categories",
            sa.column("code", sa.String()),
            sa.column("name", sa.String()),
            sa.column("description", sa.Text()),
        ),
        [
            {"code": "COMMON_CORE", "name": "Common Core", "description": "Freshman courses shared across streams."},
            {"code": "NATURAL_SCIENCE", "name": "Natural Science", "description": "Freshman courses classified for the Natural Science stream."},
            {"code": "SOCIAL_SCIENCE", "name": "Social Science", "description": "Freshman courses classified for the Social Science stream."},
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_freshman_course_category_links_category", table_name="freshman_course_category_links")
    op.drop_table("freshman_course_category_links")
    op.drop_table("freshman_course_categories")
    op.drop_index("ix_courses_academic_scope", table_name="courses")
    op.drop_constraint("uq_courses_registry_key", "courses", type_="unique")
    op.alter_column("courses", "content_version", existing_type=sa.String(length=30), nullable=True, server_default=None)
    op.alter_column("courses", "registry_key", existing_type=sa.String(length=120), nullable=True)
    op.alter_column("courses", "academic_scope", existing_type=sa.String(length=20), nullable=True, server_default=None)
    op.alter_column("courses", "stream_id", existing_type=sa.Integer(), nullable=False)
    op.create_unique_constraint("uq_courses_stream_code", "courses", ["stream_id", "code"])
    op.drop_column("courses", "content_version")
    op.drop_column("courses", "registry_key")
    op.drop_column("courses", "academic_scope")
