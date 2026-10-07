from datetime import date, datetime, timedelta, timezone
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import API_PREFIX
from app.core.deps import current_student
from app.core.time import today_local
from app.db.models.curriculum import Chapter, Course, HavanPromotion, Topic
from app.db.models.havan_planner import HavanPlan, HavanPlanSelection, HavanPlanTask
from app.db.models.student import StudentProfile, StudentTopicProgress
from app.db.session import get_db
from app.services.academic_resolver import resolve_student_courses, resolved_course_ids
from app.schemas.havan_planner import HavanPlanCreate, HavanPlanRead, HavanPlanTaskAction, HavanPlanTaskRead

router = APIRouter(prefix=f"{API_PREFIX}/havan-planner", tags=["havan-planner"])


def _read(db: Session, plan: HavanPlan, tasks: list[HavanPlanTask]) -> HavanPlanRead:
    topic_ids = {task.topic_id for task in tasks}
    topics = list(db.scalars(select(Topic).where(Topic.id.in_(topic_ids))).all()) if topic_ids else []
    topic_map = {topic.id: topic for topic in topics}
    chapter_ids = {topic.chapter_id for topic in topics}
    chapters = list(db.scalars(select(Chapter).where(Chapter.id.in_(chapter_ids))).all()) if chapter_ids else []
    chapter_map = {chapter.id: chapter for chapter in chapters}
    course_ids = {chapter.course_id for chapter in chapters}
    courses = list(db.scalars(select(Course).where(Course.id.in_(course_ids))).all()) if course_ids else []
    course_map = {course.id: course for course in courses}
    resolved = {item.course_id: item for item in resolve_student_courses(db, plan.student_id)}

    reads = []
    for task in tasks:
        topic = topic_map[task.topic_id]
        chapter = chapter_map[topic.chapter_id]
        course = course_map[chapter.course_id]
        reads.append(HavanPlanTaskRead(
            id=task.id,
            course_id=course.id,
            course_code=resolved.get(course.id).display_code if resolved.get(course.id) else course.code,
            course_name=resolved.get(course.id).display_name if resolved.get(course.id) else course.name,
            chapter_name=chapter.name,
            topic_id=topic.id,
            topic_name=topic.name,
            planned_date=task.planned_date,
            minutes=task.minutes,
            important_points=topic.important_points,
            academy_video_url=task.academy_video_url,
            academy_notes_url=task.academy_notes_url,
            academy_questions_url=task.academy_questions_url,
            freshman_question_count=task.freshman_question_count,
            promotions=[{"id": p.id, "platform_name": p.platform_name, "description": p.description, "button_text": p.button_text, "url": p.url, "status": p.status} for p in db.scalars(select(HavanPromotion).where(((HavanPromotion.chapter_id == chapter.id) | (HavanPromotion.topic_id == topic.id)), func.upper(HavanPromotion.status) == "ACTIVE")).all()],
            status=task.status,
        ))
    return HavanPlanRead(
        id=plan.id,
        student_id=plan.student_id,
        mode=plan.mode,
        horizon_days=plan.horizon_days,
        study_days=[int(x) for x in plan.study_days.split(",") if x != ""],
        hours_per_day={int(k): float(v) for k, v in json.loads(plan.hours_per_day_json or "{}").items()},
        total_minutes=plan.total_minutes,
        tasks=reads,
    )


def _validate_input(db: Session, student_id: int, payload: HavanPlanCreate) -> tuple[list[Topic], list[date]]:
    if db.get(StudentProfile, student_id) is None:
        raise HTTPException(status_code=404, detail="Student profile not found")

    expected_horizon = {"today": 1, "week": 7, "month": 28}[payload.mode]
    if payload.horizon_days != expected_horizon:
        raise HTTPException(status_code=400, detail="The selected plan mode and horizon do not match")

    if any(day < 0 or day > 6 for day in payload.study_days):
        raise HTTPException(status_code=400, detail="Study days must use weekday values from 0 to 6")

    today = today_local()
    if payload.mode == "today":
        study_days = [today]
    else:
        if not payload.study_days:
            raise HTTPException(status_code=400, detail="Week and month plans need at least one study day")
        selected_weekdays = set(payload.study_days)
        study_days = [
            today + timedelta(days=offset)
            for offset in range(payload.horizon_days)
            if (today + timedelta(days=offset)).weekday() in selected_weekdays
        ]

    if not study_days:
        raise HTTPException(status_code=400, detail="No study days are available in the selected planning window")

    for weekday in {day.weekday() for day in study_days}:
        hours = float(payload.hours_per_day.get(weekday, 0))
        if hours <= 0 or hours > 24:
            raise HTTPException(status_code=400, detail="Every selected study day needs a valid daily study time")

    selected_ids = list(dict.fromkeys(payload.topic_ids))
    if len(selected_ids) != len(payload.topic_ids):
        raise HTTPException(status_code=400, detail="A topic can only be selected once")

    topics = list(db.scalars(
        select(Topic)
        .join(Chapter, Topic.chapter_id == Chapter.id)
        .where(
            Topic.id.in_(selected_ids),
            func.upper(Topic.status) == "ACTIVE",
            func.upper(Chapter.status) == "ACTIVE",
        )
        .order_by(Chapter.course_id, Chapter.order_index, Topic.order_index, Topic.id)
    ).all())
    if len(topics) != len(selected_ids):
        raise HTTPException(status_code=400, detail="Every selected topic must be active and available")

    allowed_course_ids = resolved_course_ids(db, student_id)
    for topic in topics:
        chapter = db.get(Chapter, topic.chapter_id)
        if chapter is None or chapter.course_id not in allowed_course_ids:
            raise HTTPException(status_code=400, detail="Every selected topic must belong to one of your active mapped courses")

    return topics, study_days


def _allocate(topics: list[Topic], study_days: list[date], hours_per_day: dict[int, float]) -> list[tuple[Topic, date, int]]:
    capacities = {day: int(round(float(hours_per_day[day.weekday()]) * 60)) for day in study_days}
    total_capacity = sum(capacities.values())
    if total_capacity <= 0:
        raise HTTPException(status_code=400, detail="Available study time must be greater than zero")

    weights = [max(1, int(topic.estimated_study_minutes)) for topic in topics]
    weight_total = sum(weights)
    raw = [total_capacity * weight / weight_total for weight in weights]
    targets = [int(value) for value in raw]
    remainder = total_capacity - sum(targets)
    for index in sorted(range(len(topics)), key=lambda i: (-(raw[i] - targets[i]), i))[:remainder]:
        targets[index] += 1

    remaining = {topic.id: target for topic, target in zip(topics, targets)}
    tasks: list[tuple[Topic, date, int]] = []
    cursor = 0

    while any(minutes > 0 for minutes in remaining.values()):
        day = next((candidate for candidate in study_days if capacities[candidate] > 0), None)
        if day is None:
            raise HTTPException(status_code=500, detail="Havan allocation integrity check failed")

        placed = False
        for offset in range(len(topics)):
            topic = topics[(cursor + offset) % len(topics)]
            if remaining[topic.id] <= 0:
                continue
            chunk = min(remaining[topic.id], capacities[day])
            tasks.append((topic, day, chunk))
            remaining[topic.id] -= chunk
            capacities[day] -= chunk
            cursor = (cursor + offset + 1) % len(topics)
            placed = True
            break
        if not placed:
            raise HTTPException(status_code=500, detail="Havan allocation integrity check failed")

    if sum(minutes for _, _, minutes in tasks) != total_capacity:
        raise HTTPException(status_code=500, detail="Havan allocation integrity check failed")
    return tasks


def _build_plan(db: Session, student_id: int, payload: HavanPlanCreate) -> HavanPlan:
    topics, study_days = _validate_input(db, student_id, payload)
    allocated = _allocate(topics, study_days, payload.hours_per_day)
    plan = HavanPlan(
        student_id=student_id,
        mode=payload.mode,
        horizon_days=payload.horizon_days,
        study_days=",".join(str(day) for day in sorted({day.weekday() for day in study_days})),
        hours_per_day_json=json.dumps({str(day): value for day, value in payload.hours_per_day.items()}),
        total_minutes=sum(minutes for _, _, minutes in allocated),
    )
    db.add(plan)
    db.flush()

    for topic, planned_date, minutes in allocated:
        chapter = db.get(Chapter, topic.chapter_id)
        db.add(HavanPlanSelection(plan_id=plan.id, course_id=chapter.course_id, topic_id=topic.id, course_minutes=minutes))
        db.add(HavanPlanTask(plan_id=plan.id, course_id=chapter.course_id, topic_id=topic.id, planned_date=planned_date, minutes=minutes))
    return plan


def _preview(db: Session, student_id: int, payload: HavanPlanCreate) -> HavanPlanRead:
    plan = _build_plan(db, student_id, payload)
    tasks = list(db.scalars(select(HavanPlanTask).where(HavanPlanTask.plan_id == plan.id).order_by(HavanPlanTask.planned_date, HavanPlanTask.id)).all())
    result = _read(db, plan, tasks)
    db.rollback()
    return result.model_copy(update={"id": None})


@router.post("/me/preview", response_model=HavanPlanRead)
def preview_plan(payload: HavanPlanCreate, student: StudentProfile = Depends(current_student), db: Session = Depends(get_db)):
    return _preview(db, student.id, payload)


@router.post("/me/plans", response_model=HavanPlanRead)
def create_current_plan(payload: HavanPlanCreate, student: StudentProfile = Depends(current_student), db: Session = Depends(get_db)):
    plan = _build_plan(db, student.id, payload)
    db.commit()
    db.refresh(plan)
    tasks = list(db.scalars(select(HavanPlanTask).where(HavanPlanTask.plan_id == plan.id).order_by(HavanPlanTask.planned_date, HavanPlanTask.id)).all())
    return _read(db, plan, tasks)


@router.get("/me/latest", response_model=HavanPlanRead)
def latest_current_plan(student: StudentProfile = Depends(current_student), db: Session = Depends(get_db)):
    plan = db.scalar(select(HavanPlan).where(HavanPlan.student_id == student.id).order_by(HavanPlan.id.desc()))
    if plan is None:
        raise HTTPException(status_code=404, detail="No Havan plan found")
    tasks = list(db.scalars(select(HavanPlanTask).where(HavanPlanTask.plan_id == plan.id).order_by(HavanPlanTask.planned_date, HavanPlanTask.id)).all())
    return _read(db, plan, tasks)


@router.post("/me/plans/{plan_id}/tasks/{task_id}/actions", response_model=HavanPlanRead)
def action_current_task(plan_id: int, task_id: int, payload: HavanPlanTaskAction, student: StudentProfile = Depends(current_student), db: Session = Depends(get_db)):
    plan = db.scalar(select(HavanPlan).where(HavanPlan.id == plan_id, HavanPlan.student_id == student.id))
    if plan is None:
        raise HTTPException(status_code=404, detail="Havan plan not found")
    task = db.scalar(select(HavanPlanTask).where(HavanPlanTask.id == task_id, HavanPlanTask.plan_id == plan.id))
    if task is None:
        raise HTTPException(status_code=404, detail="Havan task not found")

    if payload.action == "START":
        if task.status == "PLANNED":
            task.status = "IN_PROGRESS"
    elif task.status != "DONE":
        task.status = "DONE"
        progress = db.scalar(select(StudentTopicProgress).where(
            StudentTopicProgress.student_id == student.id,
            StudentTopicProgress.topic_id == task.topic_id,
        ))
        topic = db.get(Topic, task.topic_id)
        if progress is None:
            progress = StudentTopicProgress(student_id=student.id, topic_id=task.topic_id)
            db.add(progress)
        progress.completed_minutes += task.minutes
        progress.study_sessions += 1
        progress.last_studied_at = datetime.now(timezone.utc)
        if topic and progress.completed_minutes >= topic.estimated_study_minutes:
            progress.completed_minutes = topic.estimated_study_minutes
            progress.status = "COMPLETED"
        else:
            progress.status = "IN_PROGRESS"

    db.commit()
    db.refresh(plan)
    tasks = list(db.scalars(select(HavanPlanTask).where(HavanPlanTask.plan_id == plan.id).order_by(HavanPlanTask.planned_date, HavanPlanTask.id)).all())
    return _read(db, plan, tasks)
