from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class HavanPlan(Base):
    __tablename__ = "havan_plans"
    __table_args__ = (UniqueConstraint("student_id", "id", name="uq_havan_plans_student_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    mode: Mapped[str] = mapped_column(String(10), nullable=False)
    horizon_days: Mapped[int] = mapped_column(Integer, nullable=False)
    study_days: Mapped[str] = mapped_column(String(50), nullable=False, default="", server_default="")
    hours_per_day_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}", server_default="{}")
    total_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class HavanPlanSelection(Base):
    __tablename__ = "havan_plan_selections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("havan_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    course_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")


class HavanPlanTask(Base):
    __tablename__ = "havan_plan_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("havan_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    planned_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    academy_video_url: Mapped[Optional[str]] = mapped_column(Text)
    academy_notes_url: Mapped[Optional[str]] = mapped_column(Text)
    academy_questions_url: Mapped[Optional[str]] = mapped_column(Text)
    freshman_question_count: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PLANNED", server_default="PLANNED")
