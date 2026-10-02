from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.models.curriculum import (
    Curriculum,
    FreshmanCurriculumMapping,
    FreshmanCurriculumTemplate,
    University,
)
from app.db.session import get_db
from app.schemas.curriculum import (
    FreshmanCurriculumMappingCreate,
    FreshmanCurriculumMappingRead,
    FreshmanCurriculumMappingUpdate,
)

router = APIRouter(prefix="/api/v1/freshman-mappings", tags=["freshman-mappings"])
DB = Depends(get_db)


def _query():
    return (
        select(FreshmanCurriculumMapping)
        .options(
            joinedload(FreshmanCurriculumMapping.curriculum).joinedload(Curriculum.university),
            joinedload(FreshmanCurriculumMapping.template),
        )
        .order_by(FreshmanCurriculumMapping.id.desc())
    )


def _read(item: FreshmanCurriculumMapping) -> FreshmanCurriculumMappingRead:
    return FreshmanCurriculumMappingRead(
        id=item.id,
        curriculum_id=item.curriculum_id,
        curriculum_name=item.curriculum.name,
        curriculum_version=item.curriculum.version,
        university_id=item.curriculum.university_id,
        university_name=item.curriculum.university.name,
        template_id=item.template_id,
        template_code=item.template.code,
        template_name=item.template.name,
        template_version=item.template.version,
        template_academic_year=item.template.academic_year,
        status=item.status,
        notes=item.notes,
    )


def _get(db: Session, mapping_id: int) -> FreshmanCurriculumMapping:
    item = db.scalar(_query().where(FreshmanCurriculumMapping.id == mapping_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Freshman curriculum mapping not found.")
    return item


def _validate_targets(db: Session, curriculum_id: int, template_id: int) -> tuple[Curriculum, FreshmanCurriculumTemplate]:
    curriculum = db.scalar(
        select(Curriculum).options(joinedload(Curriculum.university)).where(Curriculum.id == curriculum_id)
    )
    if curriculum is None:
        raise HTTPException(status_code=404, detail="University curriculum not found.")

    template = db.get(FreshmanCurriculumTemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Freshman curriculum template not found.")

    return curriculum, template


@router.get("", response_model=list[FreshmanCurriculumMappingRead])
def list_mappings(
    db: Session = DB,
    curriculum_id: int | None = None,
    university_id: int | None = None,
    status_filter: str | None = None,
):
    query = _query()
    if curriculum_id is not None:
        query = query.where(FreshmanCurriculumMapping.curriculum_id == curriculum_id)
    if university_id is not None:
        query = query.join(FreshmanCurriculumMapping.curriculum).where(Curriculum.university_id == university_id)
    if status_filter is not None:
        query = query.where(FreshmanCurriculumMapping.status == status_filter)
    return [_read(item) for item in db.scalars(query).unique().all()]


@router.post("", response_model=FreshmanCurriculumMappingRead, status_code=status.HTTP_201_CREATED)
def create_mapping(payload: FreshmanCurriculumMappingCreate, db: Session = DB):
    curriculum, template = _validate_targets(db, payload.curriculum_id, payload.template_id)

    duplicate = db.scalar(
        select(FreshmanCurriculumMapping).where(
            FreshmanCurriculumMapping.curriculum_id == curriculum.id
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=409,
            detail="This university curriculum is already mapped to a Freshman national template.",
        )

    if payload.status == "ACTIVE" and template.status != "ACTIVE":
        raise HTTPException(
            status_code=422,
            detail="An ACTIVE mapping requires an ACTIVE Freshman curriculum template.",
        )

    item = FreshmanCurriculumMapping(
        curriculum_id=curriculum.id,
        template_id=template.id,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(item)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The Freshman curriculum mapping could not be created.") from exc
    return _read(_get(db, item.id))


@router.get("/{mapping_id}", response_model=FreshmanCurriculumMappingRead)
def get_mapping(mapping_id: int, db: Session = DB):
    return _read(_get(db, mapping_id))


@router.patch("/{mapping_id}", response_model=FreshmanCurriculumMappingRead)
def update_mapping(mapping_id: int, payload: FreshmanCurriculumMappingUpdate, db: Session = DB):
    item = _get(db, mapping_id)
    data = payload.model_dump(exclude_unset=True)
    template = item.template

    if "template_id" in data:
        template = db.get(FreshmanCurriculumTemplate, data["template_id"])
        if template is None:
            raise HTTPException(status_code=404, detail="Freshman curriculum template not found.")
        item.template_id = template.id

    new_status = data.get("status", item.status)
    if new_status == "ACTIVE" and template.status != "ACTIVE":
        raise HTTPException(
            status_code=422,
            detail="An ACTIVE mapping requires an ACTIVE Freshman curriculum template.",
        )

    if "status" in data:
        item.status = data["status"]
    if "notes" in data:
        item.notes = data["notes"]

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The Freshman curriculum mapping could not be updated.") from exc
    return _read(_get(db, item.id))


@router.delete("/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mapping(mapping_id: int, db: Session = DB):
    item = _get(db, mapping_id)
    db.delete(item)
    db.commit()
