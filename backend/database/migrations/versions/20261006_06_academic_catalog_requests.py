"""Create student academic catalog request workflow.

Revision ID: 20261006_06
Revises: 20261006_05
"""

from alembic import op
import sqlalchemy as sa

revision = "20261006_06"
down_revision = "20261006_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if sa.inspect(bind).has_table("academic_catalog_requests"):
        return
    op.create_table(
        "academic_catalog_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "account_id",
            sa.Integer(),
            sa.ForeignKey("student_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("request_type", sa.String(length=20), nullable=False),
        sa.Column(
            "university_id",
            sa.Integer(),
            sa.ForeignKey("universities.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=True),
        sa.Column("version", sa.String(length=50), nullable=True),
        sa.Column("academic_year", sa.String(length=30), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING"),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_academic_catalog_requests_account_id", "academic_catalog_requests", ["account_id"])


def downgrade() -> None:
    bind = op.get_bind()
    if sa.inspect(bind).has_table("academic_catalog_requests"):
        op.drop_index("ix_academic_catalog_requests_account_id", table_name="academic_catalog_requests")
        op.drop_table("academic_catalog_requests")
