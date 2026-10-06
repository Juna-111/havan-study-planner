"""add account roles

Revision ID: 20261006_01
Revises: 20261004_03
Create Date: 2026-10-06
"""

from alembic import op
import sqlalchemy as sa

revision = "20261006_01"
down_revision = "20261004_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("student_accounts", sa.Column("role", sa.String(length=10), nullable=False, server_default="STUDENT"))


def downgrade() -> None:
    op.drop_column("student_accounts", "role")
