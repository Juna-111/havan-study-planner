from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class StudentAccount(Base):
    __tablename__ = "student_accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)\n    role: Mapped[str] = mapped_column(String(10), nullable=False, default="STUDENT", server_default="STUDENT")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class StudentProfile(Base):
    __tablename__ = "student_profiles"
    __table_args__ = (
        UniqueConstraint("client_key", name="uq_student_profiles_client_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[Optional[int]] = mapped_column(ForeignKey("student_accounts.id", ondelete="SET NULL"), nullable=True, unique=True)
    client_key: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    university_id: Mapped[int] = mapped_column(ForeignKey("universities.id"), nullable=False)
    curriculum_id: Mapped[int] = mapped_column(ForeignKey("curriculums.id"), nullable=False)
    stream_id: Mapped[int] = mapped_column(ForeignKey("streams.id"), nullable=False)
    study_hours_per_day: Mapped[float] = mapped_column(nullable=False, default=2.0, server_default="2")
    study_days: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    courses: Mapped[list[StudentCourse]] = relationship(back_populates="student", cascade="all, delete-orphan")
    progress: Mapped[list[StudentTopicProgress]] = relationship(back_populates="student", cascade="all, delete-orphan")
    exams: Mapped[list[StudentExam]] = relationship(back_populates="student", cascade="all, delete-orphan")


class StudentCourse(Base):
    __tablename__ = "student_courses"
    __table_args__ = (
        UniqueConstraint("student_id", "course_id", name="uq_student_course"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    confidence: Mapped[int] = mapped_column(Integer, nullable=False, default=3, server_default="3")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE", server_default="ACTIVE")
    student: Mapped[StudentProfile] = relationship(back_populates="courses")


class StudentTopicProgress(Base):
    __tablename__ = "student_topic_progress"
    __table_args__ = (
        UniqueConstraint("student_id", "topic_id", name="uq_student_topic_progress"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="NOT_STARTED", server_default="NOT_STARTED")
    confidence: Mapped[int] = mapped_column(Integer, nullable=False, default=3, server_default="3")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    last_studied_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    study_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    student: Mapped[StudentProfile] = relationship(back_populates="progress")


class StudentExam(Base):
    __tablename__ = "student_exams"
    __table_args__ = (
        UniqueConstraint("student_id", "course_id", "exam_type", "exam_date", name="uq_student_exam"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("student_profiles.id", ondelete="CASCADE"), nullable=False)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    exam_type: Mapped[str] = mapped_column(String(30), nullable=False)
    exam_date: Mapped[date] = mapped_column(Date, nullable=False)
    importance: Mapped[int] = mapped_column(Integer, nullable=False, default=3, server_default="3")
    student: Mapped[StudentProfile] = relationship(back_populates="exams")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("student_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
