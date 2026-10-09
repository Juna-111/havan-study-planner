from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    endpoint: Mapped[str] = mapped_column(String(2048), nullable=False, unique=True)
    p256dh: Mapped[str] = mapped_column(String(256), nullable=False)
    auth: Mapped[str] = mapped_column(String(256), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class NotificationDelivery(Base):
    __tablename__ = "notification_deliveries"
    __table_args__ = (UniqueConstraint("student_id", "reminder_key", name="uq_notification_delivery_student_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    reminder_key: Mapped[str] = mapped_column(String(160), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ScheduledPush(Base):
    __tablename__ = "scheduled_pushes"
    __table_args__ = (UniqueConstraint("student_id", "reminder_key", name="uq_scheduled_push_student_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    reminder_key: Mapped[str] = mapped_column(String(160), nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str] = mapped_column(String(255), nullable=False, default="/plan")
