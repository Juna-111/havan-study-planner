from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.curriculum import Chapter, Course, Curriculum, Stream, Topic, TopicRelationship, University


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
    relationships = list(db.scalars(select(TopicRelationship)).all())

    curriculum_by_id = {x.id: x for x in curriculums}
    stream_by_id = {x.id: x for x in streams}
    course_by_id = {x.id: x for x in courses}
    chapter_by_id = {x.id: x for x in chapters}
    topic_by_id = {x.id: x for x in topics}

    issues: list[QualityIssue] = []

    def add_parent_child_issue(parent_type: str, parent_id: int, child_label: str, parent_name: str) -> None:
        issues.append(_issue("warning", parent_type, parent_id, "Missing academic content", f"{parent_name} has no active {child_label}."))

    active_curriculum_ids = {x.id for x in curriculums if x.status == "ACTIVE"}
    active_streams_by_curriculum = Counter(x.curriculum_id for x in streams if x.status == "ACTIVE")
    active_courses_by_stream = Counter(x.stream_id for x in courses if x.status == "ACTIVE")
    active_chapters_by_course = Counter(x.course_id for x in chapters if x.status == "ACTIVE")
    active_topics_by_chapter = Counter(x.chapter_id for x in topics if x.status == "ACTIVE")

    for university in universities:
        if university.status == "ACTIVE" and not any(x.university_id == university.id and x.status == "ACTIVE" for x in curriculums):
            add_parent_child_issue("university", university.id, "curriculum", university.name)

    for curriculum in curriculums:
        if curriculum.status == "ACTIVE" and active_streams_by_curriculum[curriculum.id] == 0:
            add_parent_child_issue("curriculum", curriculum.id, "stream", curriculum.name)

    for stream in streams:
        if stream.status == "ACTIVE" and active_courses_by_stream[stream.id] == 0:
            add_parent_child_issue("stream", stream.id, "course", stream.name)

    for course in courses:
        if course.status == "ACTIVE" and active_chapters_by_course[course.id] == 0:
            add_parent_child_issue("course", course.id, "chapter", course.code)

    for chapter in chapters:
        if chapter.status == "ACTIVE" and active_topics_by_chapter[chapter.id] == 0:
            add_parent_child_issue("chapter", chapter.id, "topic", chapter.name)

    for course in courses:
        if course.status == "ACTIVE" and course.credit_hours is None:
            issues.append(_issue("info", "course", course.id, "Credit hours not set", f"{course.code} has no credit-hour value."))

    for topic in topics:
        if topic.status != "ACTIVE":
            continue
        if not topic.name.strip():
            issues.append(_issue("error", "topic", topic.id, "Topic name is empty", "An active topic must have a non-empty name."))
        if topic.estimated_study_minutes <= 0:
            issues.append(_issue("error", "topic", topic.id, "Invalid study time", f"{topic.name} must have a positive study duration."))
        if not 1 <= topic.difficulty <= 5:
            issues.append(_issue("error", "topic", topic.id, "Invalid difficulty", f"{topic.name} has a difficulty outside the 1–5 range."))

    order_groups: dict[int, list[int]] = {}
    for topic in topics:
        if topic.status == "ACTIVE":
            order_groups.setdefault(topic.chapter_id, []).append(topic.order_index)
    for chapter_id, orders in order_groups.items():
        duplicates = sorted(value for value, count in Counter(orders).items() if count > 1)
        if duplicates:
            chapter_name = chapter_by_id[chapter_id].name if chapter_id in chapter_by_id else str(chapter_id)
            issues.append(_issue("warning", "chapter", chapter_id, "Duplicate topic order", f"{chapter_name} contains duplicate topic order values: {', '.join(map(str, duplicates))}."))

    relationship_keys = Counter((r.source_topic_id, r.target_topic_id, r.relationship_type) for r in relationships)
    for key, count in relationship_keys.items():
        if count > 1:
            issues.append(_issue("error", "relationship", key[0], "Duplicate topic relationship", f"The relationship {key[0]} → {key[1]} ({key[2]}) appears {count} times."))

    # Prerequisite cycles can make deterministic planner ordering impossible.
    graph: dict[int, list[int]] = {}
    for rel in relationships:
        if rel.relationship_type == "prerequisite" and rel.source_topic_id in topic_by_id and rel.target_topic_id in topic_by_id:
            graph.setdefault(rel.source_topic_id, []).append(rel.target_topic_id)

    visiting: set[int] = set()
    visited: set[int] = set()
    cycle_nodes: set[int] = set()

    def visit(node: int, path: list[int]) -> None:
        if node in visiting:
            cycle_nodes.update(path[path.index(node):])
            return
        if node in visited:
            return
        visiting.add(node)
        for child in graph.get(node, []):
            visit(child, path + [child])
        visiting.remove(node)
        visited.add(node)

    for node in graph:
        visit(node, [node])

    for topic_id in sorted(cycle_nodes):
        topic = topic_by_id[topic_id]
        issues.append(_issue("error", "topic", topic_id, "Prerequisite cycle detected", f"{topic.name} participates in a prerequisite cycle. The planner cannot establish a clean prerequisite order."))

    counts = {
        "universities": len(universities),
        "curriculums": len(curriculums),
        "streams": len(streams),
        "courses": len(courses),
        "chapters": len(chapters),
        "topics": len(topics),
        "relationships": len(relationships),
    }
    severity_counts = Counter(x.severity for x in issues)
    return {
        "summary": {
            "total_records": sum(counts.values()),
            "issues": len(issues),
            "errors": severity_counts.get("error", 0),
            "warnings": severity_counts.get("warning", 0),
            "info": severity_counts.get("info", 0),
            "active_curriculums": len(active_curriculum_ids),
        },
        "counts": counts,
        "issues": [x.__dict__ for x in issues],
    }
