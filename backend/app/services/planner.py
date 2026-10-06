from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from app.core.time import parse_weekdays, today_local

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.curriculum import Chapter, Topic
from app.db.models.planner import StudyPlan, StudyTask
from app.db.models.student import StudentCourse, StudentExam, StudentProfile, StudentTopicProgress
from app.services.academic_resolver import resolved_course_ids
from app.services.planner_engine import (
    PlannerExam,
    PlannerTopic,
    schedule_tasks,
    score_topic,
)


def _study_dates(student: StudentProfile, horizon_days: int, today: date) -> list[date]:
    weekdays = parse_weekdays(student.study_days)
    return [
        today + timedelta(days=offset)
        for offset in range(horizon_days)
        if (today + timedelta(days=offset)).weekday() in weekdays
    ] or [today]


def generate_plan(
    db: Session,
    student_id: int,
    horizon_days: int = 7,
    deferred_topic_ids: set[int] | None = None,
    pinned_topic_dates: dict[int, date] | None = None,
    today: date | None = None,
) -> StudyPlan:
    student = db.get(StudentProfile, student_id)
    if not student:
        raise ValueError("Student profile not found")

    selected = list(db.scalars(
        select(StudentCourse).where(
            StudentCourse.student_id == student_id,
            func.upper(StudentCourse.status) == "ACTIVE",
        )
    ).all())
    if not selected:
        raise ValueError("Select at least one course before generating a plan")

    effective_course_ids = resolved_course_ids(db, student_id)
    selected = [item for item in selected if item.course_id in effective_course_ids]
    if not selected:
        raise ValueError("Your selected courses are no longer available in the active university curriculum.")

    course_ids = [item.course_id for item in selected]
    chapters = list(
        db.scalars(
            select(Chapter)
            .where(Chapter.course_id.in_(course_ids), func.upper(Chapter.status) == "ACTIVE")
            .order_by(Chapter.course_id, Chapter.order_index, Chapter.id)
        ).all()
    )
    chapter_ids = [chapter.id for chapter in chapters]

    topics = list(db.scalars(
        select(Topic).where(
            Topic.chapter_id.in_(chapter_ids),
            func.upper(Topic.status) == "ACTIVE",
        ).order_by(Topic.chapter_id, Topic.order_index, Topic.id)
    ).all()) if chapter_ids else []

    if not topics:
        all_topics = list(db.scalars(
            select(Topic).where(Topic.chapter_id.in_(chapter_ids))
        ).all()) if chapter_ids else []
        if all_topics:
            raise ValueError(
                "Your selected courses have topics, but they are not marked ACTIVE. "
                "Activate those topics in the curriculum before generating a plan."
            )
        raise ValueError(
            "No topics are registered for your selected courses. "
            "The academic database needs course chapters and topics before Havan can generate recommendations."
        )

    chapter_to_course = {chapter.id: chapter.course_id for chapter in chapters}
    course_confidence = {item.course_id: item.confidence for item in selected}

    progress_rows = list(db.scalars(
        select(StudentTopicProgress).where(StudentTopicProgress.student_id == student_id)
    ).all())
    progress = {row.topic_id: row for row in progress_rows}
    completed_ids = {row.topic_id for row in progress_rows if row.status == "COMPLETED"}

    today = today or today_local()
    exams = list(db.scalars(select(StudentExam).where(StudentExam.student_id == student_id)).all())
    exam_by_course: dict[int, list[StudentExam]] = defaultdict(list)
    for exam in exams:
        if exam.exam_date >= today:
            exam_by_course[exam.course_id].append(exam)

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
                estimated_minutes=max(1, topic.estimated_study_minutes - (row.completed_minutes if row else 0)),
                exam_importance=float(topic.exam_importance),
                conceptual_importance=float(topic.conceptual_importance),
                progress_status=row.status if row else "NOT_STARTED",
                progress_confidence=row.confidence if row else course_confidence.get(course_id, 3),
            )
        )

    eligible = [
        topic for topic in planner_topics
        if topic.topic_id not in completed_ids and topic.progress_status != "COMPLETED"
    ]
    if not eligible:
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
        scored.append(item)

    study_dates = _study_dates(student, horizon_days, today)
    if student.study_hours_per_day <= 0:
        raise ValueError("Available study time must be greater than zero.")

    daily_capacity = int(round(student.study_hours_per_day * 60))
    scheduled = schedule_tasks(
        scored,
        study_dates,
        daily_capacity,
        deferred_topic_ids=deferred_topic_ids,
        pinned_topic_dates=pinned_topic_dates,
    )

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


def replan_remaining(
    db: Session,
    student_id: int,
    horizon_days: int = 7,
    deferred_topic_ids: set[int] | None = None,
    pinned_topic_dates: dict[int, date] | None = None,
    today: date | None = None,
) -> StudyPlan:
    """Create a fresh plan from the student's current state.

    The previous plan remains as history. Only still-recommended sessions are
    marked REPLANNED; completed and skipped records remain untouched.
    """
    current = load_plan(db, student_id)
    if current:
        current_tasks = list(db.scalars(
            select(StudyTask).where(StudyTask.plan_id == current.id)
        ).all())

        # Preserve explicit student decisions when the week is rebuilt.
        remembered_deferred = {
            task.topic_id for task in current_tasks if task.status == "SKIPPED"
        }
        remembered_pinned = {
            task.topic_id: task.planned_date
            for task in current_tasks
            if task.status == "MOVED"
        }
        deferred_topic_ids = (deferred_topic_ids or set()) | remembered_deferred
        pinned_topic_dates = {**remembered_pinned, **(pinned_topic_dates or {})}

        for task in current_tasks:
            if task.status == "RECOMMENDED":
                task.status = "REPLANNED"
        db.flush()

    try:
        return generate_plan(
            db,
            student_id,
            horizon_days,
            deferred_topic_ids=deferred_topic_ids,
            pinned_topic_dates=pinned_topic_dates,
            today=today,
        )
    except ValueError as exc:
        if str(exc) != "There are no unfinished active topics in your selected courses.":
            raise

        # A student can complete the final remaining topic. The action itself
        # succeeded, so return an explicit empty plan instead of turning that
        # successful action into a 400 response.
        plan = StudyPlan(student_id=student_id, horizon_days=horizon_days)
        db.add(plan)
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
