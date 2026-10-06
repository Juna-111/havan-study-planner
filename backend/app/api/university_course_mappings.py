from app.core.config import API_PREFIX
from app.core.deps import require_admin
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.models.curriculum import Course, Curriculum, Stream, University, UniversityCourseMapping
from app.db.session import get_db
from app.schemas.curriculum import (
    UniversityCourseMappingCreate,
    UniversityCourseMappingRead,
    UniversityCourseMappingUpdate,
)

router = APIRouter(prefix=f"{API_PREFIX}/university-course-mappings", tags=["university-course-mappings"], dependencies=[Depends(require_admin)])
DB = Depends(get_db)


def _query():
    return (
        select(UniversityCourseMapping)
        .options(
            joinedload(UniversityCourseMapping.curriculum).joinedload(Curriculum.university),
            joinedload(UniversityCourseMapping.stream),
            joinedload(UniversityCourseMapping.course),
        )
        .order_by(
            UniversityCourseMapping.stream_id,
            UniversityCourseMapping.semester_number,
            UniversityCourseMapping.order_index,
            UniversityCourseMapping.id,
        )
    )


def _read(item: UniversityCourseMapping) -> UniversityCourseMappingRead:
    return UniversityCourseMappingRead(
        id=item.id,
        curriculum_id=item.curriculum_id,
        curriculum_name=item.curriculum.name,
        curriculum_version=item.curriculum.version,
        university_id=item.curriculum.university_id,
        university_name=item.curriculum.university.name,
        stream_id=item.stream_id,
        stream_name=item.stream.name,
        stream_code=item.stream.code,
        course_id=item.course_id,
        course_code=item.course.code,
        course_name=item.course.name,
        credit_hours=item.course.credit_hours,
        semester_number=item.semester_number,
        order_index=item.order_index,
        status=item.status,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _get(db: Session, mapping_id: int) -> UniversityCourseMapping:
    item = db.scalar(_query().where(UniversityCourseMapping.id == mapping_id))
    if item is None:
        raise HTTPException(status_code=404, detail="University course mapping not found.")
    return item


def _validate_stream_and_course(
    db: Session,
    stream_id: int,
    course_id: int,
) -> tuple[Stream, Course]:
    stream = db.scalar(
        select(Stream)
        .options(joinedload(Stream.curriculum))
        .where(Stream.id == stream_id)
    )
    if stream is None:
        raise HTTPException(status_code=404, detail="University stream not found.")
    if str(stream.status).upper() != "ACTIVE":
        raise HTTPException(status_code=422, detail="The selected stream is not active.")

    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found.")
    if str(course.status).upper() != "ACTIVE":
        raise HTTPException(status_code=422, detail="The selected course is not active.")

    return stream, course


@router.get("", response_model=list[UniversityCourseMappingRead])
def list_mappings(
    db: Session = DB,
    university_id: int | None = None,
    curriculum_id: int | None = None,
    stream_id: int | None = None,
    semester_number: int | None = None,
    status_filter: str | None = None,
):
    query = _query()

    if university_id is not None:
        query = query.join(UniversityCourseMapping.curriculum).where(
            Curriculum.university_id == university_id
        )
    if curriculum_id is not None:
        query = query.where(UniversityCourseMapping.curriculum_id == curriculum_id)
    if stream_id is not None:
        query = query.where(UniversityCourseMapping.stream_id == stream_id)
    if semester_number is not None:
        if semester_number not in (1, 2):
            raise HTTPException(status_code=422, detail="Semester must be 1 or 2.")
        query = query.where(UniversityCourseMapping.semester_number == semester_number)
    if status_filter is not None:
        query = query.where(UniversityCourseMapping.status == status_filter)

    return [_read(item) for item in db.scalars(query).unique().all()]


@router.get("/courses")
def list_available_courses(
    db: Session = DB,
    status_filter: str = "ACTIVE",
):
    courses = db.scalars(
        select(Course)
        .where(Course.status == status_filter)
        .order_by(Course.code, Course.name, Course.id)
    ).all()
    return [
        {
            "id": course.id,
            "code": course.code,
            "name": course.name,
            "credit_hours": course.credit_hours,
            "academic_scope": course.academic_scope,
            "status": course.status,
        }
        for course in courses
    ]


@router.post("", response_model=UniversityCourseMappingRead, status_code=status.HTTP_201_CREATED)
def create_mapping(payload: UniversityCourseMappingCreate, db: Session = DB):
    stream, course = _validate_stream_and_course(db, payload.stream_id, payload.course_id)

    duplicate = db.scalar(
        select(UniversityCourseMapping).where(
            UniversityCourseMapping.stream_id == stream.id,
            UniversityCourseMapping.course_id == course.id,
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=409,
            detail="This course is already mapped to the selected stream. Move it by changing its semester.",
        )

    item = UniversityCourseMapping(
        curriculum_id=stream.curriculum_id,
        stream_id=stream.id,
        course_id=course.id,
        semester_number=payload.semester_number,
        order_index=payload.order_index,
        status=payload.status,
    )
    db.add(item)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The university course mapping could not be created.") from exc

    return _read(_get(db, item.id))


@router.get("/{mapping_id}", response_model=UniversityCourseMappingRead)
def get_mapping(mapping_id: int, db: Session = DB):
    return _read(_get(db, mapping_id))


@router.patch("/{mapping_id}", response_model=UniversityCourseMappingRead)
def update_mapping(
    mapping_id: int,
    payload: UniversityCourseMappingUpdate,
    db: Session = DB,
):
    item = _get(db, mapping_id)
    data = payload.model_dump(exclude_unset=True)

    for key, value in data.items():
        setattr(item, key, value)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The university course mapping could not be updated.") from exc

    return _read(_get(db, item.id))


@router.delete("/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mapping(mapping_id: int, db: Session = DB):
    item = _get(db, mapping_id)
    db.delete(item)
    db.commit()
