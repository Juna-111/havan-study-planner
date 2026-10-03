from __future__ import annotations

from collections import defaultdict
from typing import Iterable

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.curriculum import TopicRelationship
from app.db.session import get_db
from app.schemas.topic_relationship_candidates import (
    TopicCatalogItem,
    TopicCatalogResponse,
    TopicRelationshipCandidateBatch,
    TopicRelationshipCandidateCommitResponse,
    TopicRelationshipCandidatePreview,
    TopicRelationshipCandidatePreviewResponse,
)
from app.services.topic_identity import catalog_query, resolve_topic_identity, topic_identity

router = APIRouter(prefix="/api/v1/topic-relationship-candidates", tags=["topic-relationship-candidates"])
DB = Depends(get_db)


def _catalog(db: Session) -> list[TopicCatalogItem]:
    items = []
    for topic in db.scalars(catalog_query(db)).unique().all():
        chapter = topic.chapter
        course = chapter.course
        items.append(TopicCatalogItem(
            topic_identity=topic_identity(course, chapter, topic),
            course_code=course.code,
            course_name=course.name,
            registry_key=course.registry_key,
            content_version=course.content_version,
            chapter_name=chapter.name,
            chapter_order=chapter.order_index,
            topic_name=topic.name,
            topic_order=topic.order_index,
            difficulty=topic.difficulty,
            estimated_study_minutes=topic.estimated_study_minutes,
            exam_importance=topic.exam_importance,
            conceptual_importance=topic.conceptual_importance,
        ))
    return items


def _prerequisite_graph(db: Session) -> dict[int, set[int]]:
    graph: dict[int, set[int]] = defaultdict(set)
    rows = db.execute(
        select(TopicRelationship.source_topic_id, TopicRelationship.target_topic_id)
        .where(TopicRelationship.relationship_type == "prerequisite")
    ).all()
    for source_id, target_id in rows:
        graph[source_id].add(target_id)
    return graph


def _has_path(graph: dict[int, set[int]], start: int, target: int) -> bool:
    stack = [start]
    seen: set[int] = set()
    while stack:
        node = stack.pop()
        if node == target:
            return True
        if node in seen:
            continue
        seen.add(node)
        stack.extend(graph.get(node, ()))
    return False


def _preview(db: Session, candidates: Iterable) -> list[TopicRelationshipCandidatePreview]:
    graph = _prerequisite_graph(db)
    previews = []
    seen: set[tuple[str, str, str]] = set()

    for candidate in candidates:
        key = (candidate.source_topic_identity, candidate.target_topic_identity, candidate.relationship_type)
        if key in seen:
            previews.append(TopicRelationshipCandidatePreview(
                **candidate.model_dump(), source_topic_id=None, target_topic_id=None,
                source_course_code=None, target_course_code=None,
                source_topic_name=None, target_topic_name=None,
                status="ERROR", message="Duplicate candidate appears more than once in this batch."
            ))
            continue
        seen.add(key)

        source_matches = resolve_topic_identity(db, candidate.source_topic_identity)
        target_matches = resolve_topic_identity(db, candidate.target_topic_identity)

        if len(source_matches) != 1:
            message = (
                "Source topic identity could not be resolved in the current Havan catalog."
                if not source_matches else
                "Source identity is ambiguous because more than one Havan topic matches it."
            )
            previews.append(TopicRelationshipCandidatePreview(
                **candidate.model_dump(), source_topic_id=None, target_topic_id=None,
                source_course_code=None, target_course_code=None,
                source_topic_name=None, target_topic_name=None,
                status="ERROR", message=message
            ))
            continue

        if len(target_matches) != 1:
            message = (
                "Target topic identity could not be resolved in the current Havan catalog."
                if not target_matches else
                "Target identity is ambiguous because more than one Havan topic matches it."
            )
            previews.append(TopicRelationshipCandidatePreview(
                **candidate.model_dump(), source_topic_id=None, target_topic_id=None,
                source_course_code=None, target_course_code=None,
                source_topic_name=None, target_topic_name=None,
                status="ERROR", message=message
            ))
            continue

        source, target = source_matches[0], target_matches[0]
        existing = db.scalar(select(TopicRelationship.id).where(
            TopicRelationship.source_topic_id == source.topic.id,
            TopicRelationship.target_topic_id == target.topic.id,
            TopicRelationship.relationship_type == candidate.relationship_type,
        )) is not None

        base = dict(
            **candidate.model_dump(),
            source_topic_id=source.topic.id,
            target_topic_id=target.topic.id,
            source_course_code=source.course.code,
            target_course_code=target.course.code,
            source_topic_name=source.topic.name,
            target_topic_name=target.topic.name,
            existing=existing,
        )

        if source.topic.id == target.topic.id:
            previews.append(TopicRelationshipCandidatePreview(
                **base, status="ERROR", message="A topic cannot relate to itself."
            ))
            continue

        if existing:
            previews.append(TopicRelationshipCandidatePreview(
                **base, status="EXISTING", message="This relationship already exists and will be skipped."
            ))
            continue

        if candidate.relationship_type == "prerequisite":
            if _has_path(graph, target.topic.id, source.topic.id):
                previews.append(TopicRelationshipCandidatePreview(
                    **base, status="ERROR",
                    message="This prerequisite would create a cycle in the Havan prerequisite graph."
                ))
                continue
            graph[source.topic.id].add(target.topic.id)

        previews.append(TopicRelationshipCandidatePreview(**base, status="READY"))

    return previews


def _counts(items):
    return (
        sum(item.status == "READY" for item in items),
        sum(item.status == "EXISTING" for item in items),
        sum(item.status == "ERROR" for item in items),
    )


@router.get("/catalog", response_model=TopicCatalogResponse)
def get_topic_catalog(db: Session = DB):
    items = _catalog(db)
    return TopicCatalogResponse(
        identity_rule="registry_key::normalized chapter name::normalized topic name",
        count=len(items),
        items=items,
    )


@router.post("/preview", response_model=TopicRelationshipCandidatePreviewResponse)
def preview_candidates(payload: TopicRelationshipCandidateBatch, db: Session = DB):
    items = _preview(db, payload.candidates)
    valid, warnings, errors = _counts(items)
    return TopicRelationshipCandidatePreviewResponse(
        valid_count=valid, warning_count=warnings, error_count=errors, items=items
    )


@router.post("/commit", response_model=TopicRelationshipCandidateCommitResponse, status_code=201)
def commit_candidates(payload: TopicRelationshipCandidateBatch, db: Session = DB):
    # Re-resolve immediately before mutation. Numeric Topic IDs belong to the
    # current Havan database and are never trusted from AI output.
    items = _preview(db, payload.candidates)
    valid, _, errors = _counts(items)
    if errors:
        raise HTTPException(status_code=422, detail=f"{errors} candidate relationship(s) must be fixed before import.")

    created = skipped = 0
    try:
        for item in items:
            if item.status == "EXISTING":
                skipped += 1
                continue
            db.add(TopicRelationship(
                source_topic_id=item.source_topic_id,
                target_topic_id=item.target_topic_id,
                relationship_type=item.relationship_type,
                strength=item.strength,
                notes=item.notes,
            ))
            created += 1
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="The Havan relationship candidate import failed. No changes were committed.",
        ) from exc

    return TopicRelationshipCandidateCommitResponse(
        created=created, skipped_existing=skipped, items=items
    )
