"""Persist push subscriptions and reminder deliveries."""
from alembic import op
import sqlalchemy as sa

revision = "20261009_02"
down_revision = "20261009_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("endpoint", sa.String(length=2048), nullable=False, unique=True),
        sa.Column("p256dh", sa.String(length=256), nullable=False),
        sa.Column("auth", sa.String(length=256), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_push_subscriptions_student_id", "push_subscriptions", ["student_id"])
    op.create_table(
        "notification_deliveries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reminder_key", sa.String(length=160), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("student_id", "reminder_key", name="uq_notification_delivery_student_key"),
    )
    op.create_index("ix_notification_deliveries_student_id", "notification_deliveries", ["student_id"])
    op.create_table(
        "scheduled_pushes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reminder_key", sa.String(length=160), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("url", sa.String(length=255), nullable=False, server_default="/plan"),
        sa.UniqueConstraint("student_id", "reminder_key", name="uq_scheduled_push_student_key"),
    )
    op.create_index("ix_scheduled_pushes_student_id", "scheduled_pushes", ["student_id"])
    op.create_index("ix_scheduled_pushes_due_at", "scheduled_pushes", ["due_at"])


def downgrade() -> None:
    op.drop_index("ix_scheduled_pushes_due_at", table_name="scheduled_pushes")
    op.drop_index("ix_scheduled_pushes_student_id", table_name="scheduled_pushes")
    op.drop_table("scheduled_pushes")
    op.drop_index("ix_notification_deliveries_student_id", table_name="notification_deliveries")
    op.drop_table("notification_deliveries")
    op.drop_index("ix_push_subscriptions_student_id", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")
