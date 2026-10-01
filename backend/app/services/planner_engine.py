from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Iterable


DIFFICULTY_LABELS = {
    1: "Basic",
    2: "Easy",
    3: "Intermediate",
    4: "Advanced",
    5: "Expert",
}


@dataclass(frozen=True)
class PlannerTopic:
    topic_id: int
    course_id: int
    name: str
    difficulty: int
    estimated_minutes: int
    exam_importance: float
    conceptual_importance: float
    progress_status: str = "NOT_STARTED"
    progress_confidence: int = 3
    prerequisite_ids: tuple[int, ...] = ()


@dataclass(frozen=True)
class PlannerExam:
    course_id: int
    exam_date: date
    importance: int
    exam_type: str


@dataclass(frozen=True)
class ScoredTopic:
    topic: PlannerTopic
    score: float
    reason: str
    exam_days: int | None


def exam_urgency(days: int | None) -> float:
    if days is None:
        return 0.0
    if days <= 0:
        return 1.0
    return max(0.0, 1.0 - min(days, 30) / 30)


def score_topic(topic: PlannerTopic, exam: PlannerExam | None, today: date) -> ScoredTopic:
    days = None if exam is None else max(0, (exam.exam_date - today).days)
    urgency = exam_urgency(days)
    exam_weight = (exam.importance / 5) if exam else 0.0
    importance = max(0.0, min(1.0, topic.exam_importance * 0.65 + topic.conceptual_importance * 0.35))
    difficulty = max(0.0, min(1.0, topic.difficulty / 5))
    time_efficiency = 1.0 - min(max(topic.estimated_minutes, 1), 180) / 180
    confidence_need = max(0.0, min(1.0, (4 - topic.progress_confidence) / 3))
    revision_need = 1.0 if topic.progress_status == "IN_PROGRESS" else 0.0

    score = (
        urgency * 0.28
        + exam_weight * 0.14
        + importance * 0.18
        + difficulty * 0.12
        + time_efficiency * 0.08
        + confidence_need * 0.12
        + revision_need * 0.08
    )

    reasons: list[str] = []
    if days is not None:
        reasons.append(f"{exam.exam_type.title()} in {days} day(s)")
    if exam and exam.importance >= 4:
        reasons.append("important assessment")
    if topic.exam_importance >= 0.70:
        reasons.append("high exam importance")
    if topic.difficulty >= 4:
        reasons.append(f"{DIFFICULTY_LABELS[topic.difficulty]} difficulty")
    else:
        reasons.append(f"{DIFFICULTY_LABELS[topic.difficulty]} difficulty")
    if topic.progress_confidence <= 2:
        reasons.append("low confidence")
    if topic.progress_status == "IN_PROGRESS":
        reasons.append("revision of current progress")
    if not reasons:
        reasons.append("unfinished topic in your selected course")

    return ScoredTopic(topic, round(score, 4), "; ".join(reasons), days)


def eligible_topics(
    topics: Iterable[PlannerTopic],
    completed_ids: set[int],
) -> tuple[list[PlannerTopic], list[PlannerTopic]]:
    eligible: list[PlannerTopic] = []
    blocked: list[PlannerTopic] = []
    known_ids = {topic.topic_id for topic in topics}

    for topic in topics:
        if topic.topic_id in completed_ids or topic.progress_status == "COMPLETED":
            continue
        unresolved = [
            prerequisite_id
            for prerequisite_id in topic.prerequisite_ids
            if prerequisite_id in known_ids and prerequisite_id not in completed_ids
        ]
        if unresolved:
            blocked.append(topic)
        else:
            eligible.append(topic)

    return eligible, blocked


def schedule_tasks(
    scored: list[ScoredTopic],
    study_dates: list[date],
    daily_capacity: int,
) -> list[tuple[ScoredTopic, date, int]]:
    if not study_dates or daily_capacity <= 0:
        return []

    output: list[tuple[ScoredTopic, date, int]] = []
    day_used = {day: 0 for day in study_dates}
    ordered = sorted(scored, key=lambda item: (-item.score, item.topic.estimated_minutes))

    for item in ordered:
        remaining = max(1, item.topic.estimated_minutes)
        for day in study_dates:
            available = daily_capacity - day_used[day]
            if available <= 0:
                continue
            duration = min(remaining, available)
            output.append((item, day, duration))
            day_used[day] += duration
            remaining -= duration
            if remaining <= 0:
                break

    return output
