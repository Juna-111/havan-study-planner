from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.models.curriculum import Chapter, Course, Topic


def normalize_identity_part(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "").strip().casefold()
    return re.sub(r"\s+", " ", value)


def topic_identity(course: Course, chapter: Chapter, topic: Topic) -> str:
    return (
        f"{course.registry_key.strip()}::"
        f"{normalize_identity_part(chapter.name)}::"
        f"{normalize_identity_part(topic.name)}"
    )


@dataclass(frozen=True)
class ResolvedTopic:
    identity: str
    course: Course
    chapter: Chapter
    topic: Topic


def resolve_topic_identity(db: Session, identity: str) -> list[ResolvedTopic]:
    parts = identity.split("::", 2)
    if len(parts) != 3:
        return []
    registry_key, chapter_name, topic_name = (part.strip() for part in parts)
    if not registry_key or not chapter_name or not topic_name:
        return []

    course = db.scalar(select(Course).where(Course.registry_key == registry_key))
    if course is None:
        return []

    chapters = db.scalars(
        select(Chapter)
        .options(joinedload(Chapter.topics))
        .where(Chapter.course_id == course.id)
        .order_by(Chapter.order_index, Chapter.id)
    ).unique().all()

    chapter_key = normalize_identity_part(chapter_name)
    topic_key = normalize_identity_part(topic_name)
    matches: list[ResolvedTopic] = []
    for chapter in chapters:
        if normalize_identity_part(chapter.name) != chapter_key:
            continue
        for topic in chapter.topics:
            if normalize_identity_part(topic.name) == topic_key:
                matches.append(ResolvedTopic(identity, course, chapter, topic))
    return matches


def catalog_query(db: Session):
    return (
        select(Topic)
        .options(joinedload(Topic.chapter).joinedload(Chapter.course))
        .join(Chapter, Topic.chapter_id == Chapter.id)
        .join(Course, Chapter.course_id == Course.id)
        .where(
            Topic.status == "ACTIVE",
            Chapter.status == "ACTIVE",
            Course.status == "ACTIVE",
        )
        .order_by(Course.registry_key, Chapter.order_index, Topic.order_index, Topic.id)
    )
