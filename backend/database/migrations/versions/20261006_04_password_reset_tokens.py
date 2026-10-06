"""Create password reset token persistence.

Revision ID: 20261006_04
Revises: 20261006_03
"""

from alembic import op
import sqlalchemy as sa

revision = "20261006_04"
down_revision = "20261006_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("password_reset_tokens"):
        return
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "account_id",
            sa.Integer(),
            sa.ForeignKey("student_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_password_reset_tokens_account_id", "password_reset_tokens", ["account_id"])
    op.create_index("ix_password_reset_tokens_expires_at", "password_reset_tokens", ["expires_at"])


def downgrade() -> None:
    bind = op.get_bind()
    if sa.inspect(bind).has_table("password_reset_tokens"):
        op.drop_index("ix_password_reset_tokens_expires_at", table_name="password_reset_tokens")
        op.drop_index("ix_password_reset_tokens_account_id", table_name="password_reset_tokens")
        op.drop_table("password_reset_tokens")
