from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models.curriculum import (
    Course,
    FreshmanCurriculumTemplate,
    FreshmanTemplateCourse,
    FreshmanTemplateSemester,
)
from app.db.session import get_db
from app.schemas.curriculum import (
    FreshmanCurriculumTemplateCreate,
    FreshmanCurriculumTemplateRead,
    FreshmanCurriculumTemplateUpdate,
    FreshmanTemplateCourseAssignment,
)

router = APIRouter(prefix="/api/v1/freshman-templates", tags=["freshman-templates"])
DB = Depends(get_db)


def _template_query():
    return (
        select(FreshmanCurriculumTemplate)
        .options(
            selectinload(FreshmanCurriculumTemplate.semesters)
            .selectinload(FreshmanTemplateSemester.courses)
            .selectinload(FreshmanTemplateCourse.course)
        )
        .order_by(FreshmanCurriculumTemplate.code, FreshmanCurriculumTemplate.version)
    )


def _read(template: FreshmanCurriculumTemplate) -> FreshmanCurriculumTemplateRead:
    return FreshmanCurriculumTemplateRead(
        id=template.id,
        code=template.code,
        name=template.name,
        version=template.version,
        academic_year=template.academic_year,
        description=template.description,
        status=template.status,
        semesters=[
            {
                "id": semester.id,
                "template_id": template.id,
                "semester_number": semester.semester_number,
                "name": semester.name,
                "description": semester.description,
                "courses": [
                    {
                        "id": placement.id,
                        "semester_id": semester.id,
                        "course_id": placement.course_id,
                        "course_code": placement.course.code,
                        "course_name": placement.course.name,
                        "requirement_type": placement.requirement_type,
                        "order_index": placement.order_index,
                        "notes": placement.notes,
                    }
                    for placement in semester.courses
                ],
            }
            for semester in template.semesters
        ],
    )


def _validate_semesters(semesters) -> None:
    numbers = [item.semester_number for item in semesters]
    if len(numbers) != 2 or sorted(numbers) != [1, 2]:
        raise HTTPException(
            status_code=422,
            detail="A Freshman curriculum template must contain exactly Semester I and Semester II.",
        )


def _get_template(db: Session, template_id: int) -> FreshmanCurriculumTemplate:
    template = db.scalar(_template_query().where(FreshmanCurriculumTemplate.id == template_id))
    if template is None:
        raise HTTPException(status_code=404, detail="Freshman curriculum template not found.")
    return template


@router.get("", response_model=list[FreshmanCurriculumTemplateRead])
def list_templates(db: Session = DB):
    return [_read(item) for item in db.scalars(_template_query()).unique().all()]


@router.post("", response_model=FreshmanCurriculumTemplateRead, status_code=status.HTTP_201_CREATED)
def create_template(payload: FreshmanCurriculumTemplateCreate, db: Session = DB):
    _validate_semesters(payload.semesters)
    duplicate = db.scalar(
        select(FreshmanCurriculumTemplate).where(
            FreshmanCurriculumTemplate.code == payload.code,
            FreshmanCurriculumTemplate.version == payload.version,
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Freshman template {payload.code} version {payload.version} already exists.",
        )

    template = FreshmanCurriculumTemplate(
        code=payload.code,
        name=payload.name,
        version=payload.version,
        academic_year=payload.academic_year,
        description=payload.description,
        status=payload.status,
    )
    db.add(template)
    try:
        db.flush()
        for semester_payload in payload.semesters:
            semester = FreshmanTemplateSemester(
                template_id=template.id,
                semester_number=semester_payload.semester_number,
                name=semester_payload.name,
                description=semester_payload.description,
            )
            db.add(semester)
            db.flush()
            for course_payload in semester_payload.courses:
                course = db.scalar(
                    select(Course).where(
                        Course.id == course_payload.course_id,
                        Course.academic_scope == "FRESHMAN",
                    )
                )
                if course is None:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Course {course_payload.course_id} is not a Freshman registry course.",
                    )
                db.add(
                    FreshmanTemplateCourse(
                        semester_id=semester.id,
                        course_id=course.id,
                        requirement_type=course_payload.requirement_type,
                        order_index=course_payload.order_index,
                        notes=course_payload.notes,
                    )
                )
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The Freshman template could not be created.") from exc

    return _read(_get_template(db, template.id))


@router.get("/{template_id}", response_model=FreshmanCurriculumTemplateRead)
def get_template(template_id: int, db: Session = DB):
    return _read(_get_template(db, template_id))


@router.patch("/{template_id}", response_model=FreshmanCurriculumTemplateRead)
def update_template(template_id: int, payload: FreshmanCurriculumTemplateUpdate, db: Session = DB):
    template = _get_template(db, template_id)
    data = payload.model_dump(exclude_unset=True)

    if "code" in data or "version" in data:
        code = data.get("code", template.code)
        version = data.get("version", template.version)
        duplicate = db.scalar(
            select(FreshmanCurriculumTemplate).where(
                FreshmanCurriculumTemplate.code == code,
                FreshmanCurriculumTemplate.version == version,
                FreshmanCurriculumTemplate.id != template.id,
            )
        )
        if duplicate is not None:
            raise HTTPException(status_code=409, detail="Another Freshman template already uses that code/version.")

    for key, value in data.items():
        setattr(template, key, value)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The Freshman template update conflicts with an existing template.") from exc
    return _read(_get_template(db, template.id))


@router.post("/{template_id}/courses", response_model=FreshmanCurriculumTemplateRead)
def assign_course(template_id: int, payload: FreshmanTemplateCourseAssignment, db: Session = DB):
    template = _get_template(db, template_id)
    semester = next((item for item in template.semesters if item.semester_number == payload.semester_number), None)
    if semester is None:
        raise HTTPException(status_code=422, detail="The template must contain Semester I and Semester II.")

    course = db.scalar(
        select(Course).where(
            Course.id == payload.course_id,
            Course.academic_scope == "FRESHMAN",
        )
    )
    if course is None:
        raise HTTPException(status_code=404, detail="Freshman registry course not found.")

    duplicate = db.scalar(
        select(FreshmanTemplateCourse).where(
            FreshmanTemplateCourse.semester_id == semester.id,
            FreshmanTemplateCourse.course_id == course.id,
        )
    )
    if duplicate is not None:
        raise HTTPException(status_code=409, detail="That course is already assigned to this semester.")

    db.add(
        FreshmanTemplateCourse(
            semester_id=semester.id,
            course_id=course.id,
            requirement_type=payload.requirement_type,
            order_index=payload.order_index,
            notes=payload.notes,
        )
    )
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The course could not be assigned to the template.") from exc
    return _read(_get_template(db, template.id))


@router.delete("/{template_id}/courses/{placement_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_course(template_id: int, placement_id: int, db: Session = DB):
    _get_template(db, template_id)
    placement = db.scalar(
        select(FreshmanTemplateCourse)
        .join(FreshmanTemplateSemester)
        .where(
            FreshmanTemplateCourse.id == placement_id,
            FreshmanTemplateSemester.template_id == template_id,
        )
    )
    if placement is None:
        raise HTTPException(status_code=404, detail="Template course placement not found.")
    db.delete(placement)
    db.commit()
