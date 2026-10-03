from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.curriculum import Chapter, Course, Topic, TopicRelationship
from app.db.session import get_db
from app.schemas.topic_relationship_import import (
    TopicRelationshipImportCommit,
    TopicRelationshipImportResult,
    TopicRelationshipPreviewItem,
)
from app.services.topic_relationship_import_parser import parse_topic_relationships

router = APIRouter(prefix="/api/v1/topic-relationship-import", tags=["topic-relationship-import"])
DB = Depends(get_db)
MAX_FILE_SIZE = 5 * 1024 * 1024


def _topic_map(db: Session, topic_ids: set[int]) -> dict[int, Topic]:
    if not topic_ids:
        return {}
    topics = db.scalars(select(Topic).where(Topic.id.in_(topic_ids))).all()
    return {topic.id: topic for topic in topics}


def _resolve_ref(db: Session, reference: str) -> tuple[Course, Topic] | None:
    code, raw_id = reference.rsplit(":", 1)
    topic = db.get(Topic, int(raw_id))
    if topic is None:
        return None
    chapter = db.get(Chapter, topic.chapter_id)
    if chapter is None:
        return None
    course = db.get(Course, chapter.course_id)
    if course is None or course.code.strip().upper() != code.strip().upper():
        return None
    return course, topic


def _validate_items(db: Session, items, *, include_existing: bool) -> list[TopicRelationshipPreviewItem]:
    previews: list[TopicRelationshipPreviewItem] = []
    for item in items:
        source = _resolve_ref(db, item.source_ref)
        target = _resolve_ref(db, item.target_ref)
        if source is None:
            raise HTTPException(status_code=422, detail=f"Line {getattr(item, 'line_number', '?')}: source topic '{item.source_ref}' was not found.")
        if target is None:
            raise HTTPException(status_code=422, detail=f"Line {getattr(item, 'line_number', '?')}: target topic '{item.target_ref}' was not found.")

        source_course, source_topic = source
        target_course, target_topic = target
        if source_topic.id == target_topic.id:
            raise HTTPException(status_code=422, detail=f"Line {getattr(item, 'line_number', '?')}: a topic cannot relate to itself.")

        existing = db.scalar(
            select(TopicRelationship.id).where(
                TopicRelationship.source_topic_id == source_topic.id,
                TopicRelationship.target_topic_id == target_topic.id,
                TopicRelationship.relationship_type == item.relationship_type,
            )
        ) is not None

        previews.append(
            TopicRelationshipPreviewItem(
                source_ref=item.source_ref,
                target_ref=item.target_ref,
                relationship_type=item.relationship_type,
                strength=item.strength,
                notes=item.notes,
                line_number=getattr(item, "line_number", 0),
                source_topic_id=source_topic.id,
                target_topic_id=target_topic.id,
                source_course_code=source_course.code,
                target_course_code=target_course.code,
                source_topic_name=source_topic.name,
                target_topic_name=target_topic.name,
                existing=existing if include_existing else False,
            )
        )
    return previews


async def _read_file(file: UploadFile) -> str:
    if not file.filename or not file.filename.lower().endswith((".txt", ".md")):
        raise HTTPException(status_code=415, detail="Upload a .txt or .md relationship file.")
    raw = await file.read()
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="The relationship file must be 5 MB or smaller.")
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="The relationship file must be UTF-8 text.") from exc


@router.post("/preview", response_model=list[TopicRelationshipPreviewItem])
async def preview_topic_relationship_import(file: UploadFile = File(...), db: Session = DB):
    content = await _read_file(file)
    parsed = parse_topic_relationships(content)
    return _validate_items(db, parsed, include_existing=True)


@router.post("/commit", response_model=TopicRelationshipImportResult, status_code=201)
def commit_topic_relationship_import(payload: TopicRelationshipImportCommit, db: Session = DB):
    # Re-resolve every reference immediately before mutation. Preview is a dry run,
    # never a trusted database snapshot.
    previews = _validate_items(db, payload.items, include_existing=True)
    created = 0
    skipped = 0

    try:
        for item, preview in zip(payload.items, previews, strict=True):
            if preview.existing:
                skipped += 1
                continue

            db.add(
                TopicRelationship(
                    source_topic_id=preview.source_topic_id,
                    target_topic_id=preview.target_topic_id,
                    relationship_type=item.relationship_type,
                    strength=item.strength,
                    notes=item.notes,
                )
            )
            created += 1

        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The relationship import could not be saved. No changes were committed.") from exc

    return TopicRelationshipImportResult(created=created, skipped_existing=skipped, relationships=previews)
