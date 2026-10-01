from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.curriculum import Chapter, Course, Topic, TopicRelationship
from app.db.models.planner import StudyPlan, StudyTask
from app.db.models.student import StudentCourse, StudentExam, StudentProfile, StudentTopicProgress
from app.services.planner_engine import (
    PlannerExam,
    PlannerTopic,
    eligible_topics,
    schedule_tasks,
    score_topic,
)


def _study_dates(student: StudentProfile, horizon_days: int, today: date) -> list[date]:
    raw_days = student.study_days or []
    weekdays: set[int] = set()
    names = {
        "sun": 6, "sunday": 6, "mon": 0, "monday": 0,
        "tue": 1, "tuesday": 1, "wed": 2, "wednesday": 2,
        "thu": 3, "thursday": 3, "fri": 4, "friday": 4,
        "sat": 5, "saturday": 5,
    }

    for value in raw_days:
        if isinstance(value, int) and 0 <= value <= 6:
            weekdays.add((value - 1) % 7)
        elif isinstance(value, str):
            lowered = value.strip().lower()
            if lowered.isdigit() and 0 <= int(lowered) <= 6:
                weekdays.add((int(lowered) - 1) % 7)
            elif lowered in names:
                weekdays.add(names[lowered])

    if not weekdays:
        weekdays = {0, 1, 2, 3, 4}

    return [
        today + timedelta(days=offset)
        for offset in range(horizon_days)
        if (today + timedelta(days=offset)).weekday() in weekdays
    ] or [today]


def generate_plan(db: Session, student_id: int, horizon_days: int = 7) -> StudyPlan:
    student = db.get(StudentProfile, student_id)
    if not student:
        raise ValueError("Student profile not found")

    selected = list(db.scalars(
        select(StudentCourse).where(
            StudentCourse.student_id == student_id,
            StudentCourse.status == "ACTIVE",
        )
    ).all())
    if not selected:
        raise ValueError("Select at least one course before generating a plan")

    course_ids = [item.course_id for item in selected]
    courses = {
        course.id: course
        for course in db.scalars(select(Course).where(Course.id.in_(course_ids))).all()
    }
    chapters = list(db.scalars(
        select(Chapter).where(Chapter.course_id.in_(course_ids))
    ).all())
    chapter_ids = [chapter.id for chapter in chapters]
    topics = list(db.scalars(
        select(Topic).where(
            Topic.chapter_id.in_(chapter_ids),
            Topic.status == "ACTIVE",
        )
    ).all()) if chapter_ids else []

    if not topics:
        raise ValueError("Your selected courses do not have active topics yet")

    chapter_to_course = {chapter.id: chapter.course_id for chapter in chapters}
    course_confidence = {item.course_id: item.confidence for item in selected}

    progress_rows = list(db.scalars(
        select(StudentTopicProgress).where(StudentTopicProgress.student_id == student_id)
    ).all())
    progress = {row.topic_id: row for row in progress_rows}
    completed_ids = {row.topic_id for row in progress_rows if row.status == "COMPLETED"}

    today = date.today()
    exams = list(db.scalars(
        select(StudentExam).where(StudentExam.student_id == student_id)
    ).all())
    exam_by_course: dict[int, list[StudentExam]] = defaultdict(list)
    for exam in exams:
        if exam.exam_date >= today:
            exam_by_course[exam.course_id].append(exam)

    topic_ids = {topic.id for topic in topics}
    relationships = list(db.scalars(
        select(TopicRelationship).where(
            TopicRelationship.relationship_type == "PREREQUISITE",
            TopicRelationship.target_topic_id.in_(topic_ids),
        )
    ).all()) if topic_ids else []

    prerequisite_map: dict[int, list[int]] = defaultdict(list)
    for relationship in relationships:
        prerequisite_map[relationship.target_topic_id].append(relationship.source_topic_id)

    planner_topics: list[PlannerTopic] = []
    for topic in topics:
        course_id = chapter_to_course[topic.chapter_id]
        row = progress.get(topic.id)
        planner_topics.append(
            PlannerTopic(
                topic_id=topic.id,
                course_id=course_id,
                name=topic.name,
                difficulty=topic.difficulty,
                estimated_minutes=topic.estimated_study_minutes,
                exam_importance=float(topic.exam_importance),
                conceptual_importance=float(topic.conceptual_importance),
                progress_status=row.status if row else "NOT_STARTED",
                progress_confidence=row.confidence if row else course_confidence.get(course_id, 3),
                prerequisite_ids=tuple(
                    prerequisite_id
                    for prerequisite_id in prerequisite_map.get(topic.id, [])
                    if prerequisite_id in topic_ids
                ),
            )
        )

    eligible, blocked = eligible_topics(planner_topics, completed_ids)
    if not eligible:
        if blocked:
            raise ValueError(
                "Your remaining topics are waiting on unfinished prerequisites. "
                "Complete the prerequisite topics first."
            )
        raise ValueError("There are no unfinished active topics in your selected courses.")

    scored = []
    for topic in eligible:
        future_exams = exam_by_course.get(topic.course_id, [])
        nearest_exam = min(future_exams, key=lambda exam: exam.exam_date) if future_exams else None
        exam = (
            PlannerExam(
                course_id=nearest_exam.course_id,
                exam_date=nearest_exam.exam_date,
                importance=nearest_exam.importance,
                exam_type=nearest_exam.exam_type,
            )
            if nearest_exam else None
        )
        item = score_topic(topic, exam, today)
        if topic.prerequisite_ids:
            item = type(item)(
                topic=item.topic,
                score=item.score,
                reason=item.reason + "; prerequisites are completed",
                exam_days=item.exam_days,
            )
        scored.append(item)

    study_dates = _study_dates(student, horizon_days, today)
    daily_capacity = max(15, int(round(student.study_hours_per_day * 60)))
    scheduled = schedule_tasks(scored, study_dates, daily_capacity)

    if not scheduled:
        raise ValueError("There is not enough available study time to schedule a task.")

    plan = StudyPlan(student_id=student_id, horizon_days=horizon_days)
    db.add(plan)
    db.flush()

    for scored_topic, planned_date, minutes in scheduled:
        db.add(StudyTask(
            plan_id=plan.id,
            student_id=student_id,
            course_id=scored_topic.topic.course_id,
            topic_id=scored_topic.topic.topic_id,
            planned_date=planned_date,
            estimated_minutes=minutes,
            priority=scored_topic.score,
            reason=scored_topic.reason,
            status="RECOMMENDED",
        ))

    db.commit()
    db.refresh(plan)
    return plan


def load_plan(db: Session, student_id: int, plan_id: int | None = None) -> StudyPlan | None:
    if plan_id:
        return db.scalar(
            select(StudyPlan).where(
                StudyPlan.id == plan_id,
                StudyPlan.student_id == student_id,
            )
        )
    return db.scalar(
        select(StudyPlan)
        .where(StudyPlan.student_id == student_id)
        .order_by(StudyPlan.id.desc())
    )
