"""Resolve the effective university course structure consumed by students and the planner.

The admin-facing source of truth is intentionally simple:
University + stream -> course -> semester 1 or semester 2.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.academic_catalog import Course, Stream, UniversityCourseMapping, UniversityCourseOffering
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


def _active_offering_rows(db: Session, stream_id: int):
    rows = list(
        db.execute(
            select(UniversityCourseOffering, Course)
            .join(Course, Course.id == UniversityCourseOffering.course_id)
            .where(
                UniversityCourseOffering.stream_id == stream_id,
                UniversityCourseOffering.status == "ACTIVE",
                Course.status == "ACTIVE",
            )
            .order_by(
                UniversityCourseOffering.semester_number,
                UniversityCourseOffering.order_index,
                Course.code,
                Course.id,
            )
        ).all()
    )
    if rows:
        return rows

    # Compatibility bridge: older data imported before the offering table existed
    # still needs to remain readable while the offering model becomes canonical.
    return list(
        db.execute(
            select(UniversityCourseMapping, Course)
            .join(Course, Course.id == UniversityCourseMapping.course_id)
            .where(
                UniversityCourseMapping.stream_id == stream_id,
                UniversityCourseMapping.status == "ACTIVE",
                Course.status == "ACTIVE",
            )
            .order_by(
                UniversityCourseMapping.semester_number,
                UniversityCourseMapping.order_index,
                Course.code,
                Course.id,
            )
        ).all()
    )


def resolve_stream_courses(db: Session, stream_id: int) -> list[ResolvedCourse]:
    """Return the active courses explicitly mapped to a university stream."""

    stream = db.get(Stream, stream_id)
    if stream is None or str(stream.status).upper() != "ACTIVE":
        return []

    rows = _active_offering_rows(db, stream_id)
    rows.sort(key=lambda pair: (pair[0].semester_number, pair[0].order_index, pair[1].code, pair[1].id))

    return [
        ResolvedCourse(
            course_id=course.id,
            semester_number=mapping.semester_number,
            order_index=mapping.order_index,
            requirement_type=None,
            display_code=course.code,
            display_name=course.name,
            credit_hours=course.credit_hours,
        )
        for mapping, course in rows
    ]


def resolve_student_courses(db: Session, student_id: int) -> list[ResolvedCourse]:
    student = db.get(StudentProfile, student_id)
    if student is None:
        return []
    return resolve_stream_courses(db, student.stream_id)


def resolved_course_ids(db: Session, student_id: int) -> set[int]:
    return {item.course_id for item in resolve_student_courses(db, student_id)}
