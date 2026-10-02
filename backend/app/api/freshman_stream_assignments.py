from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.models.curriculum import (
    Curriculum,
    FreshmanCurriculumMapping,
    FreshmanStreamCourseAssignment,
    FreshmanTemplateCourse,
    Stream,
)
from app.db.session import get_db
from app.schemas.curriculum import (
    FreshmanStreamCourseAssignmentCreate,
    FreshmanStreamCourseAssignmentRead,
    FreshmanStreamCourseAssignmentUpdate,
)

router = APIRouter(prefix="/api/v1/freshman-stream-assignments", tags=["freshman-stream-assignments"])
DB = Depends(get_db)


def _query():
    return (
        select(FreshmanStreamCourseAssignment)
        .options(
            joinedload(FreshmanStreamCourseAssignment.stream)
            .joinedload(Stream.curriculum)
            .joinedload(Curriculum.university),
            joinedload(FreshmanStreamCourseAssignment.template_course)
            .joinedload(FreshmanTemplateCourse.semester),
            joinedload(FreshmanStreamCourseAssignment.template_course)
            .joinedload(FreshmanTemplateCourse.course),
        )
        .order_by(FreshmanStreamCourseAssignment.id.desc())
    )


def _read(item: FreshmanStreamCourseAssignment) -> FreshmanStreamCourseAssignmentRead:
    stream = item.stream
    curriculum = stream.curriculum
    university = curriculum.university
    placement = item.template_course
    semester = placement.semester
    course = placement.course
    return FreshmanStreamCourseAssignmentRead(
        id=item.id,
        stream_id=stream.id,
        stream_name=stream.name,
        stream_code=stream.code,
        curriculum_id=curriculum.id,
        curriculum_name=curriculum.name,
        university_id=curriculum.university_id,
        university_name=university.name,
        template_course_id=placement.id,
        semester_number=semester.semester_number,
        semester_name=semester.name,
        course_id=course.id,
        course_code=course.code,
        course_name=course.name,
        requirement_type=placement.requirement_type,
        order_index=placement.order_index,
        status=item.status,
        notes=item.notes,
    )


def _get(db: Session, assignment_id: int) -> FreshmanStreamCourseAssignment:
    item = db.scalar(_query().where(FreshmanStreamCourseAssignment.id == assignment_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Freshman stream course assignment not found.")
    return item


def _validate_targets(
    db: Session, stream_id: int, template_course_id: int
) -> tuple[Stream, FreshmanTemplateCourse, FreshmanCurriculumMapping]:
    stream = db.scalar(
        select(Stream)
        .options(joinedload(Stream.curriculum))
        .where(Stream.id == stream_id)
    )
    if stream is None:
        raise HTTPException(status_code=404, detail="University stream not found.")

    placement = db.scalar(
        select(FreshmanTemplateCourse)
        .options(
            joinedload(FreshmanTemplateCourse.semester),
            joinedload(FreshmanTemplateCourse.course),
        )
        .where(FreshmanTemplateCourse.id == template_course_id)
    )
    if placement is None:
        raise HTTPException(status_code=404, detail="Freshman template course placement not found.")

    mapping = db.scalar(
        select(FreshmanCurriculumMapping).where(
            FreshmanCurriculumMapping.curriculum_id == stream.curriculum_id
        )
    )
    if mapping is None:
        raise HTTPException(
            status_code=422,
            detail="Map this university curriculum to a national Freshman template before assigning courses to its streams.",
        )

    if mapping.template_id != placement.semester.template_id:
        raise HTTPException(
            status_code=422,
            detail="The selected Freshman course belongs to a different national template than this curriculum mapping.",
        )

    return stream, placement, mapping


@router.get("", response_model=list[FreshmanStreamCourseAssignmentRead])
def list_assignments(
    db: Session = DB,
    stream_id: int | None = None,
    curriculum_id: int | None = None,
    university_id: int | None = None,
):
    query = _query()
    if stream_id is not None:
        query = query.where(FreshmanStreamCourseAssignment.stream_id == stream_id)
    if curriculum_id is not None:
        query = query.join(FreshmanStreamCourseAssignment.stream).where(Stream.curriculum_id == curriculum_id)
    if university_id is not None:
        query = (
            query.join(FreshmanStreamCourseAssignment.stream)
            .join(Stream.curriculum)
            .where(Curriculum.university_id == university_id)
        )
    return [_read(item) for item in db.scalars(query).unique().all()]


@router.post("", response_model=FreshmanStreamCourseAssignmentRead, status_code=status.HTTP_201_CREATED)
def create_assignment(payload: FreshmanStreamCourseAssignmentCreate, db: Session = DB):
    stream, placement, mapping = _validate_targets(db, payload.stream_id, payload.template_course_id)

    duplicate = db.scalar(
        select(FreshmanStreamCourseAssignment).where(
            FreshmanStreamCourseAssignment.stream_id == stream.id,
            FreshmanStreamCourseAssignment.template_course_id == placement.id,
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=409,
            detail="This national Freshman course is already assigned to the selected stream.",
        )

    if payload.status == "ACTIVE" and (
        mapping.status != "ACTIVE" or placement.semester.template.status != "ACTIVE"
    ):
        raise HTTPException(
            status_code=422,
            detail="An ACTIVE stream assignment requires an ACTIVE curriculum mapping and ACTIVE national template.",
        )

    item = FreshmanStreamCourseAssignment(
        stream_id=stream.id,
        template_course_id=placement.id,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(item)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The Freshman stream course assignment could not be created.") from exc
    return _read(_get(db, item.id))


@router.get("/{assignment_id}", response_model=FreshmanStreamCourseAssignmentRead)
def get_assignment(assignment_id: int, db: Session = DB):
    return _read(_get(db, assignment_id))


@router.patch("/{assignment_id}", response_model=FreshmanStreamCourseAssignmentRead)
def update_assignment(
    assignment_id: int,
    payload: FreshmanStreamCourseAssignmentUpdate,
    db: Session = DB,
):
    item = _get(db, assignment_id)
    data = payload.model_dump(exclude_unset=True)

    if "status" in data and data["status"] == "ACTIVE":
        mapping = db.scalar(
            select(FreshmanCurriculumMapping).where(
                FreshmanCurriculumMapping.curriculum_id == item.stream.curriculum_id
            )
        )
        if mapping is None or mapping.status != "ACTIVE" or item.template_course.semester.template.status != "ACTIVE":
            raise HTTPException(
                status_code=422,
                detail="An ACTIVE stream assignment requires an ACTIVE curriculum mapping and ACTIVE national template.",
            )

    if "status" in data:
        item.status = data["status"]
    if "notes" in data:
        item.notes = data["notes"]

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The Freshman stream course assignment could not be updated.") from exc
    return _read(_get(db, item.id))


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(assignment_id: int, db: Session = DB):
    item = _get(db, assignment_id)
    db.delete(item)
    db.commit()
