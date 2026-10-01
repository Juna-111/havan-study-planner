"""merge conflicting heads

Revision ID: 20261001_merge_heads
Revises: 20261001_05, 20261001_auth_accounts
"""

from alembic import op


revision = "20261001_merge_heads"
down_revision = ("20261001_05", "20261001_auth_accounts")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
