"""add admin-managed Havan chapter and topic important points

Revision ID: 20261004_02
Revises: 20261004_01
Create Date: 2026-10-04
"""

from alembic import op
import sqlalchemy as sa

revision = "20261004_02"
down_revision = "20261004_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("chapters", sa.Column("important_points", sa.Text(), nullable=True))
    op.add_column("topics", sa.Column("important_points", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("topics", "important_points")
    op.drop_column("chapters", "important_points")
