from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, JSON, String, Text, Boolean, Float, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    mode: Mapped[str] = mapped_column(String(10), nullable=False)
    horizon_days: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    engine_version: Mapped[str] = mapped_column(String(20), nullable=False)
    total_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    readiness: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    warnings: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    unplaced: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    input_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict, server_default="{}")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE", server_default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PlanTask(Base):
    __tablename__ = "plan_tasks"
    __table_args__ = (
        UniqueConstraint(
            "plan_id",
            "topic_id",
            "planned_date",
            "kind",
            name="uq_plan_tasks_plan_topic_date_kind",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    planned_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    priority: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    reason_parts: Mapped[list] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    kind: Mapped[str] = mapped_column(String(10), nullable=False, default="STUDY", server_default="STUDY")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PLANNED", server_default="PLANNED")
    pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    actual_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    confidence: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
