from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import API_PREFIX
from app.core.deps import require_admin
from app.db.models.academic_catalog import Stream, UniversityCourseOffering
from app.db.session import get_db
from app.schemas.academic_catalog import UniversityCourseOfferingRead

router = APIRouter(
    prefix=f"{API_PREFIX}/university-course-offerings",
    tags=["university-course-offerings"],
    dependencies=[Depends(require_admin)],
)
DB = Depends(get_db)


def _query():
    return (
        select(UniversityCourseOffering)
        .options(
            joinedload(UniversityCourseOffering.stream).joinedload(Stream.university),
            joinedload(UniversityCourseOffering.course),
        )
        .order_by(
            UniversityCourseOffering.stream_id,
            UniversityCourseOffering.semester_number,
            UniversityCourseOffering.order_index,
            UniversityCourseOffering.id,
        )
    )


def _read(item: UniversityCourseOffering) -> UniversityCourseOfferingRead:
    return UniversityCourseOfferingRead(
        id=item.id,
        university_id=item.stream.university_id,
        university_name=item.stream.university.name,
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


@router.get("", response_model=list[UniversityCourseOfferingRead])
def list_offerings(
    db: Session = DB,
    university_id: int | None = None,
    stream_id: int | None = None,
    semester_number: int | None = None,
    status_filter: str | None = None,
):
    query = _query()
    if university_id is not None:
        query = query.join(UniversityCourseOffering.stream).where(Stream.university_id == university_id)
    if stream_id is not None:
        query = query.where(UniversityCourseOffering.stream_id == stream_id)
    if semester_number is not None:
        if semester_number not in (1, 2):
            raise HTTPException(status_code=422, detail="Semester must be 1 or 2.")
        query = query.where(UniversityCourseOffering.semester_number == semester_number)
    if status_filter is not None:
        query = query.where(UniversityCourseOffering.status == status_filter)
    return [_read(item) for item in db.scalars(query).unique().all()]
