from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.curriculum import (
    Chapter,
    Course,
    Curriculum,
    Stream,
    Topic,
    University,
    UniversityCourseMapping,
    UniversityCourseOffering,
)


@dataclass
class QualityIssue:
    severity: str
    entity_type: str
    entity_id: int
    title: str
    message: str


def _issue(severity: str, entity_type: str, entity_id: int, title: str, message: str) -> QualityIssue:
    return QualityIssue(severity, entity_type, entity_id, title, message)


def run_academic_quality_checks(db: Session) -> dict:
    universities = list(db.scalars(select(University)).all())
    curriculums = list(db.scalars(select(Curriculum)).all())
    streams = list(db.scalars(select(Stream)).all())
    courses = list(db.scalars(select(Course)).all())
    chapters = list(db.scalars(select(Chapter)).all())
    topics = list(db.scalars(select(Topic)).all())
    mappings = list(db.scalars(select(UniversityCourseOffering)).all())
    legacy_mappings = list(db.scalars(select(UniversityCourseMapping)).all())
    all_mappings = mappings + legacy_mappings


    course_by_id = {item.id: item for item in courses}
    chapter_by_id = {item.id: item for item in chapters}

    issues: list[QualityIssue] = []

    def add_parent_child_issue(entity_type: str, entity_id: int, child_label: str, name: str) -> None:
        issues.append(
            _issue(
                "warning",
                entity_type,
                entity_id,
                "Missing academic content",
                f"{name} has no active {child_label}.",
            )
        )

    active_curriculums = {item.id for item in curriculums if item.status == "ACTIVE"}
    active_streams = {item.id for item in streams if item.status == "ACTIVE"}
    active_courses = {item.id for item in courses if item.status == "ACTIVE"}
    active_chapters = {item.id for item in chapters if item.status == "ACTIVE"}
    active_topics = {item.id for item in topics if item.status == "ACTIVE"}

    active_streams_by_curriculum = Counter(
        item.curriculum_id for item in streams if item.status == "ACTIVE"
    )
    active_mappings_by_stream = Counter(
        item.stream_id for item in all_mappings if item.status == "ACTIVE"
    )
    active_chapters_by_course = Counter(
        item.course_id for item in chapters if item.status == "ACTIVE"
    )
    active_topics_by_chapter = Counter(
        item.chapter_id for item in topics if item.status == "ACTIVE"
    )

    # Missing children in the active academic hierarchy.
    for university in universities:
        if (
            university.status == "ACTIVE"
            and not any(
                item.university_id == university.id and item.status == "ACTIVE"
                for item in curriculums
            )
        ):
            add_parent_child_issue("university", university.id, "curriculum", university.name)

    for curriculum in curriculums:
        if curriculum.status == "ACTIVE" and active_streams_by_curriculum[curriculum.id] == 0:
            add_parent_child_issue("curriculum", curriculum.id, "stream", curriculum.name)

    for stream in streams:
        if stream.status == "ACTIVE" and active_mappings_by_stream[stream.id] == 0:
            add_parent_child_issue("stream", stream.id, "mapped course", stream.name)

    for course in courses:
        if course.status == "ACTIVE" and active_chapters_by_course[course.id] == 0:
            add_parent_child_issue("course", course.id, "chapter", course.code)

    for chapter in chapters:
        if chapter.status == "ACTIVE" and active_topics_by_chapter[chapter.id] == 0:
            add_parent_child_issue("chapter", chapter.id, "topic", chapter.name)

    # Content completeness checks for the planner-facing academic content.
    for chapter in chapters:
        if chapter.status == "ACTIVE" and not (getattr(chapter, "important_points", None) or "").strip():
            issues.append(
                _issue(
                    "warning",
                    "chapter",
                    chapter.id,
                    "Missing critical points",
                    f"{chapter.name} has no admin-entered critical points.",
                )
            )

    for topic in topics:
        if topic.status == "ACTIVE" and not (getattr(topic, "important_points", None) or "").strip():
            issues.append(
                _issue(
                    "warning",
                    "topic",
                    topic.id,
                    "Missing critical points",
                    f"{topic.name} has no admin-entered critical points.",
                )
            )

    # Active records whose parent is inactive. These records exist, but cannot
    # safely participate in the active planner dataset.
    for curriculum in curriculums:
        if (
            curriculum.status == "ACTIVE"
            and curriculum.university_id not in {item.id for item in universities if item.status == "ACTIVE"}
        ):
            issues.append(
                _issue(
                    "error",
                    "curriculum",
                    curriculum.id,
                    "Inactive or missing university",
                    f"{curriculum.name} is active but its university is not active.",
                )
            )

    for stream in streams:
        if stream.status == "ACTIVE" and stream.curriculum_id not in active_curriculums:
            issues.append(
                _issue(
                    "error",
                    "stream",
                    stream.id,
                    "Inactive or missing curriculum",
                    f"{stream.name} is active but its curriculum is not active.",
                )
            )

    for chapter in chapters:
        if chapter.status == "ACTIVE" and chapter.course_id not in active_courses:
            issues.append(
                _issue(
                    "error",
                    "chapter",
                    chapter.id,
                    "Inactive or missing course",
                    f"{chapter.name} is active but its course is not active.",
                )
            )

    for course in courses:
        if course.status == "ACTIVE" and course.stream_id is not None and course.stream_id not in active_streams:
            issues.append(
                _issue(
                    "error",
                    "course",
                    course.id,
                    "Inactive or missing stream",
                    f"{course.code} is active but its stream is not active.",
                )
            )

    for topic in topics:
        if topic.status == "ACTIVE" and topic.chapter_id not in active_chapters:
            issues.append(
                _issue(
                    "error",
                    "topic",
                    topic.id,
                    "Inactive or missing chapter",
                    f"{topic.name} is active but its chapter is not active.",
                )
            )

    for mapping in all_mappings:
        if mapping.status != "ACTIVE":
            continue
        if mapping.stream_id not in active_streams:
            issues.append(
                _issue(
                    "error",
                    "course_offering" if isinstance(mapping, UniversityCourseOffering) else "course_mapping",
                    mapping.id,
                    "Inactive or missing stream",
                    f"{'Offering' if isinstance(mapping, UniversityCourseOffering) else 'Mapping'} #{mapping.id} points to a stream that is not active.",
                )
            )
        if mapping.curriculum_id not in active_curriculums:
            issues.append(
                _issue(
                    "error",
                    "course_offering" if isinstance(mapping, UniversityCourseOffering) else "course_mapping",
                    mapping.id,
                    "Inactive or missing curriculum",
                    f"{'Offering' if isinstance(mapping, UniversityCourseOffering) else 'Mapping'} #{mapping.id} points to a curriculum that is not active.",
                )
            )
        course = course_by_id.get(mapping.course_id)
        if course is None or course.status != "ACTIVE":
            issues.append(
                _issue(
                    "error",
                    "course_offering" if isinstance(mapping, UniversityCourseOffering) else "course_mapping",
                    mapping.id,
                    "Inactive or missing course",
                    f"{'Offering' if isinstance(mapping, UniversityCourseOffering) else 'Mapping'} #{mapping.id} points to an inactive or missing course.",
                )
            )

    # Planner-critical course values.
    for course in courses:
        if course.status == "ACTIVE" and course.credit_hours is None:
            issues.append(
                _issue(
                    "info",
                    "course",
                    course.id,
                    "Credit hours not set",
                    f"{course.code} has no credit-hour value.",
                )
            )

    # Planner-critical topic values.
    invalid_topic_ids: set[int] = set()
    for topic in topics:
        if topic.status != "ACTIVE":
            continue

        if not topic.name.strip():
            invalid_topic_ids.add(topic.id)
            issues.append(
                _issue(
                    "error",
                    "topic",
                    topic.id,
                    "Topic name is empty",
                    "An active topic must have a non-empty name.",
                )
            )
        if topic.estimated_study_minutes <= 0:
            invalid_topic_ids.add(topic.id)
            issues.append(
                _issue(
                    "error",
                    "topic",
                    topic.id,
                    "Invalid study time",
                    f"{topic.name} must have a positive study duration.",
                )
            )
        if not 1 <= topic.difficulty <= 5:
            invalid_topic_ids.add(topic.id)
            issues.append(
                _issue(
                    "error",
                    "topic",
                    topic.id,
                    "Invalid difficulty",
                    f"{topic.name} has a difficulty outside the 1–5 range.",
                )
            )
        if not 0 <= topic.exam_importance <= 1:
            invalid_topic_ids.add(topic.id)
            issues.append(
                _issue(
                    "error",
                    "topic",
                    topic.id,
                    "Invalid exam importance",
                    f"{topic.name} must have exam importance between 0 and 1.",
                )
            )
        if not 0 <= topic.conceptual_importance <= 1:
            invalid_topic_ids.add(topic.id)
            issues.append(
                _issue(
                    "error",
                    "topic",
                    topic.id,
                    "Invalid conceptual importance",
                    f"{topic.name} must have conceptual importance between 0 and 1.",
                )
            )

    # Duplicate ordering is a warning because it is recoverable, but it can
    # make deterministic presentation/order less predictable.
    order_groups: dict[int, list[int]] = {}
    for topic in topics:
        if topic.status == "ACTIVE":
            order_groups.setdefault(topic.chapter_id, []).append(topic.order_index)

    for chapter_id, orders in order_groups.items():
        duplicates = sorted(value for value, count in Counter(orders).items() if count > 1)
        if duplicates:
            chapter_name = chapter_by_id[chapter_id].name if chapter_id in chapter_by_id else str(chapter_id)
            issues.append(
                _issue(
                    "warning",
                    "chapter",
                    chapter_id,
                    "Duplicate topic order",
                    f"{chapter_name} contains duplicate topic order values: {', '.join(map(str, duplicates))}.",
                )
            )

    # A course is planner-ready when it is active, has an active chapter with
    # active topics, has credit hours, and its active topics pass value checks.
    ready_courses = 0
    for course in courses:
        if course.id not in active_courses:
            continue
        course_chapters = [chapter for chapter in chapters if chapter.status == "ACTIVE" and chapter.course_id == course.id]
        course_topics = [
            topic
            for chapter in course_chapters
            for topic in topics
            if topic.status == "ACTIVE" and topic.chapter_id == chapter.id
        ]
        complete_content = bool(course_topics) and all(
            (getattr(topic, "important_points", None) or "").strip()
            for topic in course_topics
        )
        if (
            course.credit_hours is not None
            and complete_content
            and not any(topic.id in invalid_topic_ids for topic in course_topics)
        ):
            ready_courses += 1

    readiness = {
        "status": "ready",
        "active_courses": len(active_courses),
        "ready_courses": ready_courses,
        "active_topics": len(active_topics),
        "active_course_offerings": sum(1 for item in all_mappings if item.status == "ACTIVE"),
        "active_course_mappings": sum(1 for item in all_mappings if item.status == "ACTIVE"),
        "invalid_topics": len(invalid_topic_ids),
    }

    if invalid_topic_ids:
        readiness["status"] = "error"
    elif ready_courses < len(active_courses):
        readiness["status"] = "warning"

    counts = {
        "universities": len(universities),
        "curriculums": len(curriculums),
        "streams": len(streams),
        "courses": len(courses),
        "chapters": len(chapters),
        "topics": len(topics),
        "course_offerings": len(mappings),
        "course_mappings": len(all_mappings),
        "legacy_course_mappings": len(legacy_mappings),
    }
    severity_counts = Counter(item.severity for item in issues)

    return {
        "summary": {
            "total_records": sum(counts.values()),
            "issues": len(issues),
            "errors": severity_counts.get("error", 0),
            "warnings": severity_counts.get("warning", 0),
            "info": severity_counts.get("info", 0),
            "active_curriculums": len(active_curriculums),
        },
        "counts": counts,
        "readiness": readiness,
        "issues": [item.__dict__ for item in issues],
    }
