from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
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
    curriculums: Mapped[list[Curriculum]] = relationship(back_populates="university", cascade="all, delete-orphan")


class Curriculum(Base):
    __tablename__ = "curriculums"
    __table_args__ = (
        UniqueConstraint("university_id", "name", "version", name="uq_curriculums_university_name_version"),
        Index("ix_curriculums_university_id", "university_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    university_id: Mapped[int] = mapped_column(ForeignKey("universities.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    academic_year: Mapped[Optional[str]] = mapped_column(String(30))
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT", server_default="DRAFT")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    university: Mapped[University] = relationship(back_populates="curriculums")
    streams: Mapped[list[Stream]] = relationship(back_populates="curriculum", cascade="all, delete-orphan")


class Stream(Base):
    __tablename__ = "streams"
    __table_args__ = (
        UniqueConstraint("curriculum_id", "code", name="uq_streams_curriculum_code"),
        Index("ix_streams_curriculum_id", "curriculum_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    curriculum_id: Mapped[int] = mapped_column(ForeignKey("curriculums.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE", server_default="ACTIVE")
    curriculum: Mapped[Curriculum] = relationship(back_populates="streams")
    courses: Mapped[list[Course]] = relationship(back_populates="stream", cascade="all, delete-orphan")


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (
        UniqueConstraint("stream_id", "code", name="uq_courses_stream_code"),
        Index("ix_courses_stream_id", "stream_id"),
        Index("ix_courses_name", "name"),
        CheckConstraint("credit_hours >= 0", name="ck_courses_credit_hours_nonnegative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stream_id: Mapped[int] = mapped_column(ForeignKey("streams.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    credit_hours: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE", server_default="ACTIVE")
    stream: Mapped[Stream] = relationship(back_populates="courses")
    chapters: Mapped[list[Chapter]] = relationship(back_populates="course", cascade="all, delete-orphan", order_by="Chapter.order_index")


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
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE", server_default="ACTIVE")
    course: Mapped[Course] = relationship(back_populates="chapters")
    topics: Mapped[list[Topic]] = relationship(back_populates="chapter", cascade="all, delete-orphan", order_by="Topic.order_index")


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
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False, default=3, server_default="3")
    estimated_study_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60, server_default="60")
    exam_importance: Mapped[float] = mapped_column(nullable=False, default=0.5, server_default="0.5")
    conceptual_importance: Mapped[float] = mapped_column(nullable=False, default=0.5, server_default="0.5")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE", server_default="ACTIVE")
    chapter: Mapped[Chapter] = relationship(back_populates="topics")
    outgoing_relationships: Mapped[list[TopicRelationship]] = relationship(
        foreign_keys="TopicRelationship.source_topic_id", back_populates="source_topic", cascade="all, delete-orphan"
    )
    incoming_relationships: Mapped[list[TopicRelationship]] = relationship(
        foreign_keys="TopicRelationship.target_topic_id", back_populates="target_topic", cascade="all, delete-orphan"
    )


class TopicRelationship(Base):
    __tablename__ = "topic_relationships"
    __table_args__ = (
        UniqueConstraint("source_topic_id", "target_topic_id", "relationship_type", name="uq_topic_relationship"),
        Index("ix_topic_relationships_source", "source_topic_id"),
        Index("ix_topic_relationships_target", "target_topic_id"),
        CheckConstraint("source_topic_id <> target_topic_id", name="ck_topic_relationships_not_self"),
        CheckConstraint("strength BETWEEN 0 AND 1", name="ck_topic_relationships_strength_range"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    target_topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(30), nullable=False)
    strength: Mapped[float] = mapped_column(nullable=False, default=1.0, server_default="1.0")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    source_topic: Mapped[Topic] = relationship(foreign_keys=[source_topic_id], back_populates="outgoing_relationships")
    target_topic: Mapped[Topic] = relationship(foreign_keys=[target_topic_id], back_populates="incoming_relationships")
