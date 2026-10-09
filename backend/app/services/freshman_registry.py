from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.academic_catalog import Course, FreshmanCourseCategory


def freshman_registry_key(code: str, content_version: str) -> str:
    return f"FRESHMAN:{code.strip().upper()}:{content_version.strip()}"


def normalize_freshman_code(code: str) -> str:
    return code.strip().upper()


def get_category_map(db: Session, codes: list[str]) -> dict[str, FreshmanCourseCategory]:
    normalized = {code.strip().upper() for code in codes if code.strip()}
    if not normalized:
        return {}
    rows = db.scalars(
        select(FreshmanCourseCategory).where(FreshmanCourseCategory.code.in_(normalized))
    ).all()
    return {row.code: row for row in rows}


def set_categories(db: Session, course: Course, category_codes: list[str]) -> None:
    categories = get_category_map(db, category_codes)
    missing = sorted({code.strip().upper() for code in category_codes if code.strip()} - set(categories))
    if missing:
        raise ValueError(f"Unknown freshman course category codes: {', '.join(missing)}")
    course.freshman_categories = [categories[code] for code in sorted(categories)]


def create_freshman_course(
    db: Session,
    *,
    code: str,
    name: str,
    description: str | None = None,
    credit_hours: int | None = None,
    content_version: str = "1.0",
    status: str = "ACTIVE",
    category_codes: list[str] | None = None,
) -> Course:
    course = Course(
        stream_id=None,
        code=normalize_freshman_code(code),
        name=name.strip(),
        description=description,
        credit_hours=credit_hours,
        academic_scope="FRESHMAN",
        registry_key=freshman_registry_key(code, content_version),
        content_version=content_version.strip(),
        status=status,
    )
    db.add(course)
    if category_codes:
        set_categories(db, course, category_codes)
    return course


def get_freshman_course(db: Session, course_id: int) -> Course | None:
    return db.scalar(
        select(Course).where(
            Course.id == course_id,
            Course.academic_scope == "FRESHMAN",
        )
    )
