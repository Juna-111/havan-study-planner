from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Table, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class University(Base):
    __tablename__ = "universities"
    __table_args__ = (UniqueConstraint("code", name="uq_universities_code"), Index("ix_universities_name", "name"))

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE", server_default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
class Stream(Base):
    __tablename__ = "streams"
    __table_args__ = (
        UniqueConstraint("university_id", "code", name="uq_streams_university_code"),
        Index("ix_streams_university_id", "university_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    university_id: Mapped[int] = mapped_column(ForeignKey("universities.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE", server_default="ACTIVE")
    university: Mapped[University] = relationship()
    courses: Mapped[list[Course]] = relationship(back_populates="stream", cascade="all, delete-orphan")


freshman_course_category_links = Table(
    "freshman_course_category_links",
    Base.metadata,
    Column("course_id", ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", ForeignKey("freshman_course_categories.id", ondelete="CASCADE"), primary_key=True),
)


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (
        UniqueConstraint("registry_key", name="uq_courses_registry_key"),
        Index("ix_courses_stream_id", "stream_id"),
        Index("ix_courses_name", "name"),
        Index("ix_courses_academic_scope", "academic_scope"),
        CheckConstraint("credit_hours >= 0", name="ck_courses_credit_hours_nonnegative"),
        CheckConstraint("academic_scope IN ('UNIVERSITY', 'FRESHMAN')", name="ck_courses_academic_scope"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stream_id: Mapped[Optional[int]] = mapped_column(ForeignKey("streams.id", ondelete="CASCADE"), nullable=True)
    code: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    credit_hours: Mapped[Optional[int]] = mapped_column(Integer)
    academic_scope: Mapped[str] = mapped_column(String(20), nullable=False, default="UNIVERSITY", server_default="UNIVERSITY")
    registry_key: Mapped[str] = mapped_column(String(120), nullable=False)
    content_version: Mapped[str] = mapped_column(String(30), nullable=False, default="1.0", server_default="1.0")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE", server_default="ACTIVE")
    stream: Mapped[Optional[Stream]] = relationship(back_populates="courses")
    freshman_categories: Mapped[list[FreshmanCourseCategory]] = relationship(
        secondary=freshman_course_category_links,
        back_populates="courses",
    )
    chapters: Mapped[list[Chapter]] = relationship(back_populates="course", cascade="all, delete-orphan", order_by="Chapter.order_index")


class FreshmanCourseCategory(Base):
    __tablename__ = "freshman_course_categories"
    __table_args__ = (
        UniqueConstraint("code", name="uq_freshman_course_categories_code"),
        UniqueConstraint("name", name="uq_freshman_course_categories_name"),
        Index("ix_freshman_course_categories_code", "code"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    courses: Mapped[list[Course]] = relationship(
        secondary=freshman_course_category_links,
        back_populates="freshman_categories",
    )


class UniversityCourseMapping(Base):
    __tablename__ = "university_course_mappings"
    __table_args__ = (
        UniqueConstraint("stream_id", "course_id", name="uq_university_course_mapping_stream_course"),
        Index("ix_university_course_mapping_stream", "stream_id"),
        Index("ix_university_course_mapping_course", "course_id"),
        CheckConstraint("semester_number IN (1, 2)", name="ck_university_course_mapping_semester"),
        CheckConstraint("order_index >= 1", name="ck_university_course_mapping_order"),
        CheckConstraint("status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')", name="ck_university_course_mapping_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stream_id: Mapped[int] = mapped_column(
        ForeignKey("streams.id", ondelete="CASCADE"), nullable=False
    )
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    semester_number: Mapped[int] = mapped_column(Integer, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT", server_default="DRAFT")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    stream: Mapped[Stream] = relationship()
    course: Mapped[Course] = relationship()


class UniversityCourseOffering(Base):
    """Canonical university course offering record used by the simplified academic catalog.

    This keeps the older mapping flow operational while providing a clearer offering-oriented
    model for the newer admin and planner work.
    """

    __tablename__ = "university_course_offerings"
    __table_args__ = (
        UniqueConstraint("stream_id", "course_id", name="uq_university_course_offering_stream_course"),
        Index("ix_university_course_offering_stream", "stream_id"),
        Index("ix_university_course_offering_course", "course_id"),
        CheckConstraint("semester_number IN (1, 2)", name="ck_university_course_offering_semester"),
        CheckConstraint("order_index >= 1", name="ck_university_course_offering_order"),
        CheckConstraint("status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')", name="ck_university_course_offering_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stream_id: Mapped[int] = mapped_column(
        ForeignKey("streams.id", ondelete="CASCADE"), nullable=False
    )
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    semester_number: Mapped[int] = mapped_column(Integer, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT", server_default="DRAFT")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    stream: Mapped[Stream] = relationship()
    course: Mapped[Course] = relationship()


class Chapter(Base):

    __tablename__ = "chapters"
    __table_args__ = (
        UniqueConstraint("course_id", "order_index", name="uq_chapters_course_order"),
        Index("ix_chapters_course_id", "course_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    important_points: Mapped[Optional[str]] = mapped_column(Text)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE", server_default="ACTIVE")
    course: Mapped[Course] = relationship(back_populates="chapters")
    topics: Mapped[list[Topic]] = relationship(back_populates="chapter", cascade="all, delete-orphan", order_by="Topic.order_index")
    promotions: Mapped[list[HavanPromotion]] = relationship(back_populates="chapter", cascade="all, delete-orphan", order_by="HavanPromotion.order_index")


class Topic(Base):
    __tablename__ = "topics"
    __table_args__ = (
        UniqueConstraint("chapter_id", "name", name="uq_topics_chapter_name"),
        Index("ix_topics_chapter_id", "chapter_id"),
        Index("ix_topics_name", "name"),
        CheckConstraint("difficulty BETWEEN 1 AND 5", name="ck_topics_difficulty_range"),
        CheckConstraint("estimated_study_minutes > 0", name="ck_topics_study_minutes_positive"),
        CheckConstraint("exam_importance BETWEEN 0 AND 1", name="ck_topics_exam_importance_range"),
        CheckConstraint("conceptual_importance BETWEEN 0 AND 1", name="ck_topics_conceptual_importance_range"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chapter_id: Mapped[int] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    important_points: Mapped[Optional[str]] = mapped_column(Text)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False, default=3, server_default="3")
    estimated_study_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30, server_default="30")
    exam_importance: Mapped[float] = mapped_column(nullable=False, default=0.5, server_default="0.5")
    conceptual_importance: Mapped[float] = mapped_column(nullable=False, default=0.5, server_default="0.5")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE", server_default="ACTIVE")
    chapter: Mapped[Chapter] = relationship(back_populates="topics")
    promotions: Mapped[list[HavanPromotion]] = relationship(back_populates="topic", cascade="all, delete-orphan", order_by="HavanPromotion.order_index")


class HavanPromotion(Base):
    """Generic Havan ecosystem promotion attached to a chapter or specific topic."""
    __tablename__ = "havan_promotions"
    __table_args__ = (
        CheckConstraint("(chapter_id IS NOT NULL AND topic_id IS NULL) OR (chapter_id IS NULL AND topic_id IS NOT NULL)", name="ck_havan_promotions_one_parent"),
        CheckConstraint("order_index >= 1", name="ck_havan_promotions_order"),
        Index("ix_havan_promotions_chapter_id", "chapter_id"),
        Index("ix_havan_promotions_topic_id", "topic_id"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chapter_id: Mapped[Optional[int]] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"), nullable=True)
    topic_id: Mapped[Optional[int]] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), nullable=True)
    platform_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    button_text: Mapped[str] = mapped_column(String(100), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE", server_default="ACTIVE")
    chapter: Mapped[Optional[Chapter]] = relationship(back_populates="promotions")
    topic: Mapped[Optional[Topic]] = relationship(back_populates="promotions")
