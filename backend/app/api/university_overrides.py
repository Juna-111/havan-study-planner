from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.models.curriculum import (
    Course,
    Curriculum,
    FreshmanCurriculumMapping,
    FreshmanStreamCourseAssignment,
    FreshmanTemplateCourse,
    Stream,
    UniversityCourseOverride,
)
from app.db.session import get_db
from app.schemas.curriculum import (
    UniversityCourseOverrideCreate,
    UniversityCourseOverrideRead,
    UniversityCourseOverrideUpdate,
)

router = APIRouter(prefix="/api/v1/university-course-overrides", tags=["university-course-overrides"])
DB = Depends(get_db)


def _query():
    return (
        select(UniversityCourseOverride)
        .options(
            joinedload(UniversityCourseOverride.curriculum).joinedload(Curriculum.university),
            joinedload(UniversityCourseOverride.national_course),
            joinedload(UniversityCourseOverride.local_course),
            joinedload(UniversityCourseOverride.source_stream),
            joinedload(UniversityCourseOverride.target_stream),
        )
        .order_by(UniversityCourseOverride.id.desc())
    )


def _read(item: UniversityCourseOverride) -> UniversityCourseOverrideRead:
    curriculum = item.curriculum
    university = curriculum.university
    national = item.national_course
    local = item.local_course
    source_stream = item.source_stream
    target_stream = item.target_stream
    return UniversityCourseOverrideRead(
        id=item.id,
        curriculum_id=curriculum.id,
        curriculum_name=curriculum.name,
        university_id=curriculum.university_id,
        university_name=university.name,
        national_course_id=national.id if national else None,
        national_course_code=national.code if national else None,
        national_course_name=national.name if national else None,
        local_course_id=local.id if local else None,
        local_course_code=local.code if local else None,
        local_course_name=local.name if local else None,
        source_stream_id=source_stream.id if source_stream else None,
        source_stream_name=source_stream.name if source_stream else None,
        target_stream_id=target_stream.id if target_stream else None,
        target_stream_name=target_stream.name if target_stream else None,
        override_type=item.override_type,
        semester_number=item.semester_number,
        order_index=item.order_index,
        local_code=item.local_code,
        local_title=item.local_title,
        local_credit_hours=item.local_credit_hours,
        reason=item.reason,
        source=item.source,
        status=item.status,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _get(db: Session, override_id: int) -> UniversityCourseOverride:
    item = db.scalar(_query().where(UniversityCourseOverride.id == override_id))
    if item is None:
        raise HTTPException(status_code=404, detail="University course override not found.")
    return item


def _stream(db: Session, stream_id: int | None, curriculum_id: int) -> Stream | None:
    if stream_id is None:
        return None
    item = db.get(Stream, stream_id)
    if item is None or item.curriculum_id != curriculum_id:
        raise HTTPException(status_code=422, detail="Selected stream does not belong to this university curriculum.")
    return item


def _national_is_in_template(db: Session, curriculum: Curriculum, course_id: int) -> bool:
    mapping = db.scalar(
        select(FreshmanCurriculumMapping).where(FreshmanCurriculumMapping.curriculum_id == curriculum.id)
    )
    if mapping is None:
        return False
    return db.scalar(
        select(FreshmanTemplateCourse.id)
        .join(FreshmanTemplateCourse.semester)
        .where(
            FreshmanTemplateCourse.course_id == course_id,
            FreshmanTemplateCourse.semester.has(template_id=mapping.template_id),
        )
    ) is not None


def _validate(
    db: Session,
    payload: UniversityCourseOverrideCreate,
) -> tuple[Curriculum, Course | None, Course | None]:
    curriculum = db.get(Curriculum, payload.curriculum_id)
    if curriculum is None:
        raise HTTPException(status_code=404, detail="University curriculum not found.")

    national = db.get(Course, payload.national_course_id) if payload.national_course_id else None
    local = db.get(Course, payload.local_course_id) if payload.local_course_id else None

    if payload.override_type == "ADD":
        if national is not None:
            raise HTTPException(status_code=422, detail="An ADD override is for a university-specific course and cannot target a national course.")
        if local is None:
            raise HTTPException(status_code=422, detail="ADD requires a university-specific local course.")
        target = _stream(db, payload.target_stream_id, curriculum.id)
        if target is None:
            raise HTTPException(status_code=422, detail="ADD requires a target stream.")
        if local.stream_id != target.id:
            raise HTTPException(status_code=422, detail="The local course must belong to the selected target stream.")
    else:
        if national is None:
            raise HTTPException(status_code=422, detail=f"{payload.override_type} requires a national course.")
        if national.academic_scope != "FRESHMAN":
            raise HTTPException(status_code=422, detail="The selected national course must come from the Freshman registry.")
        if not _national_is_in_template(db, curriculum, national.id):
            raise HTTPException(status_code=422, detail="The national course is not part of this curriculum's mapped Freshman template.")
        if local is not None:
            raise HTTPException(status_code=422, detail="Only ADD overrides may reference a local course.")

    _stream(db, payload.source_stream_id, curriculum.id)
    _stream(db, payload.target_stream_id, curriculum.id)

    if payload.override_type == "MOVE" and payload.semester_number is None:
        raise HTTPException(status_code=422, detail="MOVE requires a destination semester.")
    if payload.override_type == "CHANGE_STREAM" and payload.target_stream_id is None:
        raise HTTPException(status_code=422, detail="CHANGE_STREAM requires a destination stream.")
    if payload.override_type == "METADATA" and not any(
        value is not None for value in (payload.local_code, payload.local_title, payload.local_credit_hours)
    ):
        raise HTTPException(status_code=422, detail="METADATA requires at least one local code, title, or credit override.")
    if payload.override_type == "REMOVE" and any(
        value is not None for value in (payload.target_stream_id, payload.semester_number, payload.order_index)
    ):
        raise HTTPException(status_code=422, detail="REMOVE does not accept a destination stream or semester.")

    if payload.status == "ACTIVE":
        mapping = db.scalar(
            select(FreshmanCurriculumMapping).where(FreshmanCurriculumMapping.curriculum_id == curriculum.id)
        )
        if mapping is None or mapping.status != "ACTIVE":
            raise HTTPException(status_code=422, detail="An ACTIVE override requires an ACTIVE Freshman curriculum mapping.")
        if national is not None:
            if payload.source_stream_id is not None:
                assignment = db.scalar(
                    select(FreshmanStreamCourseAssignment)
                    .join(FreshmanStreamCourseAssignment.template_course)
                    .where(
                        FreshmanStreamCourseAssignment.stream_id == payload.source_stream_id,
                        FreshmanStreamCourseAssignment.status == "ACTIVE",
                        FreshmanTemplateCourse.course_id == national.id,
                    )
                )
                if assignment is None and payload.override_type != "CHANGE_STREAM":
                    raise HTTPException(status_code=422, detail="The national course is not actively assigned to the source stream.")
        if local is not None and local.status != "ACTIVE":
            raise HTTPException(status_code=422, detail="An ACTIVE override cannot use an inactive local course.")

    return curriculum, national, local


@router.get("", response_model=list[UniversityCourseOverrideRead])
def list_overrides(
    curriculum_id: int | None = None,
    university_id: int | None = None,
    stream_id: int | None = None,
    status_filter: str | None = None,
    db: Session = DB,
):
    query = _query()
    if curriculum_id is not None:
        query = query.where(UniversityCourseOverride.curriculum_id == curriculum_id)
    if university_id is not None:
        query = query.join(UniversityCourseOverride.curriculum).where(Curriculum.university_id == university_id)
    if stream_id is not None:
        query = query.where(
            (UniversityCourseOverride.source_stream_id == stream_id)
            | (UniversityCourseOverride.target_stream_id == stream_id)
        )
    if status_filter is not None:
        query = query.where(UniversityCourseOverride.status == status_filter)
    return [_read(item) for item in db.scalars(query).unique().all()]


@router.post("", response_model=UniversityCourseOverrideRead, status_code=status.HTTP_201_CREATED)
def create_override(payload: UniversityCourseOverrideCreate, db: Session = DB):
    curriculum, national, local = _validate(db, payload)

    duplicate_filters = [
        UniversityCourseOverride.curriculum_id == curriculum.id,
        UniversityCourseOverride.status != "ARCHIVED",
    ]
    duplicate_filters.append(
        UniversityCourseOverride.national_course_id == national.id
        if national is not None
        else UniversityCourseOverride.national_course_id.is_(None)
    )
    duplicate_filters.append(
        UniversityCourseOverride.local_course_id == local.id
        if local is not None
        else UniversityCourseOverride.local_course_id.is_(None)
    )
    existing = db.scalar(select(UniversityCourseOverride).where(*duplicate_filters))
    if existing is not None:
        raise HTTPException(status_code=409, detail="An active or draft override already exists for this university course.")

    item = UniversityCourseOverride(**payload.model_dump())
    db.add(item)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The university course override could not be created.") from exc
    return _read(_get(db, item.id))


@router.get("/{override_id}", response_model=UniversityCourseOverrideRead)
def get_override(override_id: int, db: Session = DB):
    return _read(_get(db, override_id))


@router.patch("/{override_id}", response_model=UniversityCourseOverrideRead)
def update_override(
    override_id: int,
    payload: UniversityCourseOverrideUpdate,
    db: Session = DB,
):
    item = _get(db, override_id)
    data = payload.model_dump(exclude_unset=True)

    merged = {
        "curriculum_id": item.curriculum_id,
        "national_course_id": item.national_course_id,
        "local_course_id": item.local_course_id,
        "source_stream_id": data.get("source_stream_id", item.source_stream_id),
        "target_stream_id": data.get("target_stream_id", item.target_stream_id),
        "override_type": item.override_type,
        "semester_number": data.get("semester_number", item.semester_number),
        "order_index": data.get("order_index", item.order_index),
        "local_code": data.get("local_code", item.local_code),
        "local_title": data.get("local_title", item.local_title),
        "local_credit_hours": data.get("local_credit_hours", item.local_credit_hours),
        "reason": data.get("reason", item.reason),
        "source": data.get("source", item.source),
        "status": data.get("status", item.status),
    }
    payload_for_validation = UniversityCourseOverrideCreate(**merged)
    _validate(db, payload_for_validation)

    for key, value in data.items():
        setattr(item, key, value)

    db.commit()
    return _read(_get(db, item.id))


@router.delete("/{override_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_override(override_id: int, db: Session = DB):
    item = _get(db, override_id)
    db.delete(item)
    db.commit()
