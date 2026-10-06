"""add student accounts for authenticated profiles

Revision ID: 20261001_auth_accounts
"""
from alembic import op
import sqlalchemy as sa

revision = "20261001_auth_accounts"
down_revision = "20261001_02"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "student_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("email", name="uq_student_accounts_email"),
    )
    op.create_index("ix_student_accounts_email", "student_accounts", ["email"], unique=True)
    op.add_column("student_profiles", sa.Column("account_id", sa.Integer(), nullable=True))
    op.create_unique_constraint("uq_student_profiles_account_id", "student_profiles", ["account_id"])
    op.create_foreign_key("fk_student_profiles_account_id", "student_profiles", "student_accounts", ["account_id"], ["id"], ondelete="SET NULL")

def downgrade() -> None:
    op.drop_constraint("fk_student_profiles_account_id", "student_profiles", type_="foreignkey")
    op.drop_constraint("uq_student_profiles_account_id", "student_profiles", type_="unique")
    op.drop_column("student_profiles", "account_id")
    op.drop_index("ix_student_accounts_email", table_name="student_accounts")
    op.drop_table("student_accounts")
