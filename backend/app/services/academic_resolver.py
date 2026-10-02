"""Resolve the effective Freshman/university course structure for a student.

This module is the single source of truth for the academic structure consumed
by student course selection, exams, context, and the planner.
"""
from __future__ import annotations

from dataclasses import dataclass
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.curriculum import (
    Course,
    FreshmanCurriculumMapping,
    FreshmanCurriculumTemplate,
    FreshmanStreamCourseAssignment,
    FreshmanTemplateCourse,
    FreshmanTemplateSemester,
    Stream,
    UniversityCourseOverride,
)
from app.db.models.student import StudentProfile


@dataclass(frozen=True)
class ResolvedCourse:
    course_id: int
    semester_number: int | None
    order_index: int
    requirement_type: str | None
    display_code: str
    display_name: str
    credit_hours: int | None


def resolve_stream_courses(db: Session, stream_id: int) -> list[ResolvedCourse]:
    """Return the effective active courses for a university stream.

    National Freshman courses are inherited from the active curriculum mapping
    and stream assignments. University courses attached directly to the stream
    are also included. Active university overrides are applied last.

    MOVE changes placement only; REMOVE/CHANGE_STREAM change membership;
    ADD introduces a local course; METADATA changes the effective display.
    """
    stream = db.get(Stream, stream_id)
    if stream is None:
        return []

    resolved: dict[int, ResolvedCourse] = {}

    direct_courses = list(db.scalars(
        select(Course)
        .where(
            Course.stream_id == stream_id,
            func.upper(Course.status) == "ACTIVE",
        )
        .order_by(Course.id)
    ).all())

    for course in direct_courses:
        resolved[course.id] = ResolvedCourse(
            course_id=course.id,
            semester_number=None,
            order_index=course.id,
            requirement_type=None,
            display_code=course.code,
            display_name=course.name,
            credit_hours=course.credit_hours,
        )

    mapping = db.scalar(
        select(FreshmanCurriculumMapping)
        .where(
            FreshmanCurriculumMapping.curriculum_id == stream.curriculum_id,
            func.upper(FreshmanCurriculumMapping.status) == "ACTIVE",
        )
    )

    if mapping is not None:
        freshman_rows = list(db.execute(
            select(
                Course,
                FreshmanTemplateSemester.semester_number,
                FreshmanTemplateCourse.order_index,
                FreshmanTemplateCourse.requirement_type,
            )
            .join(FreshmanTemplateCourse, FreshmanTemplateCourse.course_id == Course.id)
            .join(FreshmanTemplateSemester, FreshmanTemplateSemester.id == FreshmanTemplateCourse.semester_id)
            .join(FreshmanStreamCourseAssignment, FreshmanStreamCourseAssignment.template_course_id == FreshmanTemplateCourse.id)
            .join(FreshmanCurriculumTemplate, FreshmanCurriculumTemplate.id == FreshmanTemplateSemester.template_id)
            .where(
                FreshmanStreamCourseAssignment.stream_id == stream_id,
                func.upper(FreshmanStreamCourseAssignment.status) == "ACTIVE",
                FreshmanCurriculumTemplate.id == mapping.template_id,
                func.upper(FreshmanCurriculumTemplate.status) == "ACTIVE",
                func.upper(Course.status) == "ACTIVE",
            )
            .order_by(FreshmanTemplateSemester.semester_number, FreshmanTemplateCourse.order_index, Course.id)
        ).all())

        for course, semester_number, order_index, requirement_type in freshman_rows:
            resolved[course.id] = ResolvedCourse(
                course_id=course.id,
                semester_number=semester_number,
                order_index=order_index,
                requirement_type=requirement_type,
                display_code=course.code,
                display_name=course.name,
                credit_hours=course.credit_hours,
            )

    overrides = list(db.scalars(
        select(UniversityCourseOverride)
        .where(
            UniversityCourseOverride.curriculum_id == stream.curriculum_id,
            func.upper(UniversityCourseOverride.status) == "ACTIVE",
        )
        .order_by(UniversityCourseOverride.id)
    ).all())

    for override in overrides:
        if override.override_type == "ADD":
            if override.target_stream_id != stream_id or not override.local_course_id:
                continue
            local_course = db.get(Course, override.local_course_id)
            if local_course is None or str(local_course.status).upper() != "ACTIVE":
                continue
            resolved[local_course.id] = ResolvedCourse(
                course_id=local_course.id,
                semester_number=override.semester_number,
                order_index=override.order_index or local_course.id,
                requirement_type=None,
                display_code=override.local_code or local_course.code,
                display_name=override.local_title or local_course.name,
                credit_hours=(
                    override.local_credit_hours
                    if override.local_credit_hours is not None
                    else local_course.credit_hours
                ),
            )

        elif override.override_type in {"REMOVE", "CHANGE_STREAM"}:
            course_id = override.national_course_id
            if not course_id:
                continue
            source_matches = (
                override.source_stream_id is None
                or override.source_stream_id == stream_id
            )
            if override.override_type == "REMOVE" and source_matches:
                resolved.pop(course_id, None)
            elif override.override_type == "CHANGE_STREAM":
                if source_matches:
                    resolved.pop(course_id, None)
                if override.target_stream_id == stream_id:
                    course = db.get(Course, course_id)
                    if course is not None and str(course.status).upper() == "ACTIVE":
                        resolved[course_id] = ResolvedCourse(
                            course_id=course.id,
                            semester_number=override.semester_number,
                            order_index=override.order_index or course.id,
                            requirement_type=None,
                            display_code=course.code,
                            display_name=course.name,
                            credit_hours=course.credit_hours,
                        )

        elif override.override_type == "MOVE":
            course_id = override.national_course_id
            if not course_id:
                continue
            if override.source_stream_id is not None and override.source_stream_id != stream_id:
                continue
            existing = resolved.get(course_id)
            if existing is not None:
                resolved[course_id] = ResolvedCourse(
                    course_id=existing.course_id,
                    semester_number=override.semester_number if override.semester_number is not None else existing.semester_number,
                    order_index=override.order_index if override.order_index is not None else existing.order_index,
                    requirement_type=existing.requirement_type,
                    display_code=existing.display_code,
                    display_name=existing.display_name,
                    credit_hours=existing.credit_hours,
                )

        elif override.override_type == "METADATA":
            course_id = override.national_course_id
            if not course_id or course_id not in resolved:
                continue
            existing = resolved[course_id]
            resolved[course_id] = ResolvedCourse(
                course_id=existing.course_id,
                semester_number=existing.semester_number,
                order_index=existing.order_index,
                requirement_type=existing.requirement_type,
                display_code=override.local_code or existing.display_code,
                display_name=override.local_title or existing.display_name,
                credit_hours=(
                    override.local_credit_hours
                    if override.local_credit_hours is not None
                    else existing.credit_hours
                ),
            )

    return sorted(
        resolved.values(),
        key=lambda item: (
            item.semester_number is None,
            item.semester_number if item.semester_number is not None else 99,
            item.order_index,
            item.course_id,
        ),
    )


def resolve_student_courses(db: Session, student_id: int) -> list[ResolvedCourse]:
    student = db.get(StudentProfile, student_id)
    if student is None:
        return []
    return resolve_stream_courses(db, student.stream_id)


def resolved_course_ids(db: Session, student_id: int) -> set[int]:
    return {item.course_id for item in resolve_student_courses(db, student_id)}
