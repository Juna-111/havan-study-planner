from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.time import parse_weekdays, today_local, to_index
from app.db.models.curriculum import Chapter, Course, Topic
from app.db.models.plan import Plan, PlanTask
from app.db.models.student import StudentExam, StudentProfile, StudentTopicProgress
from app.schemas.plan import PlanInput
from app.services.academic_resolver import resolved_course_ids
from app.services.planner_engine import (
    PlanRequest,
    PlannerExam,
    PlannerTopic,
    StudyCalendar,
    update_pace_factor,
)


def _pace_factor(db: Session, student_id: int) -> float:
    rows = list(db.scalars(
        select(PlanTask)
        .where(
            PlanTask.student_id == student_id,
            PlanTask.status == "DONE",
            PlanTask.actual_minutes.is_not(None),
            PlanTask.minutes > 0,
        )
        .order_by(PlanTask.id.desc())
        .limit(20)
    ).all())
    pace = 1.0
    for row in reversed(rows):
        pace = update_pace_factor(pace, row.minutes, row.actual_minutes or row.minutes)
    return pace


def _done_minutes_today(db: Session, student_id: int, today: date) -> int:
    return sum(
        int(row.minutes)
        for row in db.scalars(
            select(PlanTask).where(
                PlanTask.student_id == student_id,
                PlanTask.planned_date == today,
                PlanTask.status == "DONE",
            )
        ).all()
    )


def build_request(
    db: Session,
    student: StudentProfile,
    plan_input: PlanInput,
    today: date | None = None,
    deferred_topic_ids: Iterable[int] = (),
    pinned_topic_dates: dict[int, date] | None = None,
) -> PlanRequest:
    today = today or today_local()
    selected_ids = list(dict.fromkeys(plan_input.topic_ids))
    known_ids = set(plan_input.known_topic_ids)
    if not known_ids.issubset(selected_ids):
        raise ValueError("Known topics must come from the topics you selected.")

    allowed_courses = set(resolved_course_ids(db, student.id))
    topics = list(db.scalars(
        select(Topic)
        .join(Chapter, Topic.chapter_id == Chapter.id)
        .where(
            Topic.id.in_(selected_ids),
            Topic.status == "ACTIVE",
            Chapter.status == "ACTIVE",
        )
        .order_by(Chapter.course_id, Chapter.order_index, Topic.order_index, Topic.id)
    ).all())
    if len(topics) != len(selected_ids):
        found = {topic.id for topic in topics}
        missing = sorted(set(selected_ids) - found)
        raise ValueError(f"Some selected topics are unavailable or inactive: {missing}")

    chapter_ids = {topic.chapter_id for topic in topics}
    chapters = list(db.scalars(select(Chapter).where(Chapter.id.in_(chapter_ids))).all())
    chapter_by_id = {chapter.id: chapter for chapter in chapters}
    if any(chapter_by_id[topic.chapter_id].course_id not in allowed_courses for topic in topics):
        raise ValueError("Every selected topic must belong to the student's active curriculum.")

    progress_rows = list(db.scalars(
        select(StudentTopicProgress).where(
            StudentTopicProgress.student_id == student.id,
            StudentTopicProgress.topic_id.in_(selected_ids),
        )
    ).all())
    progress = {row.topic_id: row for row in progress_rows}

    planner_topics = [
        PlannerTopic(
            topic_id=topic.id,
            course_id=chapter_by_id[topic.chapter_id].course_id,
            name=topic.name,
            difficulty=topic.difficulty,
            estimated_minutes=max(5, topic.estimated_study_minutes - int(progress[topic.id].completed_minutes if topic.id in progress else 0)),
            exam_importance=float(topic.exam_importance),
            conceptual_importance=float(topic.conceptual_importance),
            progress_status=progress[topic.id].status if topic.id in progress else "NOT_STARTED",
            progress_confidence=progress[topic.id].confidence if topic.id in progress else 3,
            chapter_order=chapter_by_id[topic.chapter_id].order_index,
            topic_order=topic.order_index,
            last_studied_on=(
                progress[topic.id].last_studied_at.astimezone(timezone.utc).date()
                if topic.id in progress and progress[topic.id].last_studied_at
                else None
            ),
        )
        for topic in topics
    ]

    course_ids = {item.course_id for item in planner_topics}
    exams = [
        PlannerExam(
            course_id=exam.course_id,
            exam_date=exam.exam_date,
            importance=exam.importance,
            exam_type=exam.exam_type,
        )
        for exam in db.scalars(
            select(StudentExam).where(
                StudentExam.student_id == student.id,
                StudentExam.course_id.in_(course_ids),
            )
        ).all()
    ]

    weekdays = parse_weekdays(plan_input.study_days)
    minutes_by_weekday = {
        to_index(day): max(0, int(minutes))
        for day, minutes in plan_input.minutes_by_weekday.items()
    }
    default_minutes = max(5, round(plan_input.hours_per_day * 60 / 5) * 5)
    pin_dates = pinned_topic_dates or plan_input.pinned_topic_dates
    pin_topic_ids = set(pin_dates)
    pin_minutes = {
        topic.id: max(5, topic.estimated_study_minutes - int(progress[topic.id].completed_minutes if topic.id in progress else 0))
        for topic in topics if topic.id in pin_topic_ids
    }
    for pinned_date in pin_dates.values():
        weekdays = frozenset(set(weekdays) | {pinned_date.weekday()})
    minutes_by_weekday = {
        day: minutes_by_weekday.get(day, default_minutes)
        for day in weekdays
    }
    calendar = StudyCalendar(
        study_weekdays=weekdays,
        daily_minutes=default_minutes,
        minutes_by_weekday=minutes_by_weekday,
        done_minutes={today: _done_minutes_today(db, student.id, today)},
    )

    return PlanRequest(
        today=today,
        topics=planner_topics,
        exams=exams,
        calendar=calendar,
        horizon_days=plan_input.horizon_days,
        pace_factor=_pace_factor(db, student.id),
        deferred_topic_ids=frozenset(deferred_topic_ids),
        pinned_topic_dates=pinned_topic_dates or plan_input.pinned_topic_dates,
        known_topic_ids=frozenset(known_ids),
    )
