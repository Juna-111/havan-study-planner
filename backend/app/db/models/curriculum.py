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
    freshman_mapping: Mapped[Optional[FreshmanCurriculumMapping]] = relationship(back_populates="curriculum", cascade="all, delete-orphan", uselist=False)


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
    freshman_course_assignments: Mapped[list[FreshmanStreamCourseAssignment]] = relationship(
        back_populates="stream", cascade="all, delete-orphan"
    )


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
        CheckConstraint("academic_scope IN ('UNIVERSITY', 'FRESHMAN', 'COC')", name="ck_courses_academic_scope"),
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
    freshman_template_placements: Mapped[list[FreshmanTemplateCourse]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )


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


class FreshmanCurriculumTemplate(Base):
    __tablename__ = "freshman_curriculum_templates"
    __table_args__ = (
        UniqueConstraint("code", "version", name="uq_freshman_templates_code_version"),
        Index("ix_freshman_templates_code", "code"),
        Index("ix_freshman_templates_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    version: Mapped[str] = mapped_column(String(30), nullable=False)
    academic_year: Mapped[Optional[str]] = mapped_column(String(30))
    description: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT", server_default="DRAFT")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    semesters: Mapped[list[FreshmanTemplateSemester]] = relationship(
        back_populates="template", cascade="all, delete-orphan", order_by="FreshmanTemplateSemester.semester_number"
    )


class FreshmanTemplateSemester(Base):
    __tablename__ = "freshman_template_semesters"
    __table_args__ = (
        UniqueConstraint("template_id", "semester_number", name="uq_freshman_template_semester"),
        CheckConstraint("semester_number IN (1, 2)", name="ck_freshman_template_semester_number"),
        Index("ix_freshman_template_semesters_template", "template_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("freshman_curriculum_templates.id", ondelete="CASCADE"), nullable=False)
    semester_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    template: Mapped[FreshmanCurriculumTemplate] = relationship(back_populates="semesters")
    courses: Mapped[list[FreshmanTemplateCourse]] = relationship(
        back_populates="semester", cascade="all, delete-orphan", order_by="FreshmanTemplateCourse.order_index"
    )


class FreshmanTemplateCourse(Base):
    __tablename__ = "freshman_template_courses"
    __table_args__ = (
        UniqueConstraint("semester_id", "course_id", name="uq_freshman_template_semester_course"),
        CheckConstraint("requirement_type IN ('REQUIRED', 'ELECTIVE')", name="ck_freshman_template_course_requirement"),
        CheckConstraint("order_index >= 1", name="ck_freshman_template_course_order"),
        Index("ix_freshman_template_courses_semester", "semester_id"),
        Index("ix_freshman_template_courses_course", "course_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    semester_id: Mapped[int] = mapped_column(ForeignKey("freshman_template_semesters.id", ondelete="CASCADE"), nullable=False)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    requirement_type: Mapped[str] = mapped_column(String(20), nullable=False, default="REQUIRED", server_default="REQUIRED")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    semester: Mapped[FreshmanTemplateSemester] = relationship(back_populates="courses")
    course: Mapped[Course] = relationship(back_populates="freshman_template_placements")
    stream_assignments: Mapped[list[FreshmanStreamCourseAssignment]] = relationship(
        back_populates="template_course", cascade="all, delete-orphan"
    )


class FreshmanStreamCourseAssignment(Base):
    __tablename__ = "freshman_stream_course_assignments"
    __table_args__ = (
        UniqueConstraint("stream_id", "template_course_id", name="uq_freshman_stream_template_course"),
        Index("ix_freshman_stream_assignment_stream", "stream_id"),
        Index("ix_freshman_stream_assignment_template_course", "template_course_id"),
        CheckConstraint("status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')", name="ck_freshman_stream_assignment_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stream_id: Mapped[int] = mapped_column(ForeignKey("streams.id", ondelete="CASCADE"), nullable=False)
    template_course_id: Mapped[int] = mapped_column(ForeignKey("freshman_template_courses.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT", server_default="DRAFT")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    stream: Mapped[Stream] = relationship(back_populates="freshman_course_assignments")
    template_course: Mapped[FreshmanTemplateCourse] = relationship(back_populates="stream_assignments")


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


class FreshmanCurriculumMapping(Base):
    __tablename__ = "freshman_curriculum_mappings"
    __table_args__ = (
        UniqueConstraint("curriculum_id", name="uq_freshman_mapping_curriculum"),
        Index("ix_freshman_mapping_template", "template_id"),
        CheckConstraint("status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')", name="ck_freshman_mapping_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    curriculum_id: Mapped[int] = mapped_column(
        ForeignKey("curriculums.id", ondelete="CASCADE"), nullable=False
    )
    template_id: Mapped[int] = mapped_column(
        ForeignKey("freshman_curriculum_templates.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT", server_default="DRAFT")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    curriculum: Mapped[Curriculum] = relationship(back_populates="freshman_mapping")
    template: Mapped[FreshmanCurriculumTemplate] = relationship()
