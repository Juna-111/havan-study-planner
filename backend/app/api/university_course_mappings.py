from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import API_PREFIX
from app.core.deps import require_admin
from app.db.models.curriculum import Curriculum, University, UniversityCourseMapping
from app.db.session import get_db
from app.schemas.curriculum import UniversityCourseMappingRead

router = APIRouter(
    prefix=f"{API_PREFIX}/university-course-mappings",
    tags=["university-course-mappings"],
    dependencies=[Depends(require_admin)],
)
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
        query = query.join(UniversityCourseMapping.curriculum).where(Curriculum.university_id == university_id)
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
