"""Reduce the rigid default topic duration.

Revision ID: 20261007_08
Revises: 20261007_07
"""
from alembic import op
import sqlalchemy as sa
revision = "20261007_08"
down_revision = "20261007_07"
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "topics" not in inspector.get_table_names():
        return
    op.alter_column("topics", "estimated_study_minutes", existing_type=sa.Integer(), existing_nullable=False, server_default=sa.text("30"))

def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "topics" not in inspector.get_table_names():
        return
    op.alter_column("topics", "estimated_study_minutes", existing_type=sa.Integer(), existing_nullable=False, server_default=sa.text("60"))
