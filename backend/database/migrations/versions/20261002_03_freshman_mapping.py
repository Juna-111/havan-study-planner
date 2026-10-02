"""map university curricula to national Freshman templates

Revision ID: 20261002_03
Revises: 20261002_02
Create Date: 2026-10-02
"""

from alembic import op
import sqlalchemy as sa


revision = "20261002_03"
down_revision = "20261002_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "freshman_curriculum_mappings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "curriculum_id",
            sa.Integer(),
            sa.ForeignKey("curriculums.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "template_id",
            sa.Integer(),
            sa.ForeignKey("freshman_curriculum_templates.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="DRAFT"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("curriculum_id", name="uq_freshman_mapping_curriculum"),
        sa.CheckConstraint(
            "status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')",
            name="ck_freshman_mapping_status",
        ),
    )
    op.create_index(
        "ix_freshman_mapping_template",
        "freshman_curriculum_mappings",
        ["template_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_freshman_mapping_template", table_name="freshman_curriculum_mappings")
    op.drop_table("freshman_curriculum_mappings")
