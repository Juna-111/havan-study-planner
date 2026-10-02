from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.planner import StudyPlan, StudyTask
from app.db.models.curriculum import Topic
from app.db.models.student import StudentProfile, StudentTopicProgress
from app.db.session import get_db
from app.schemas.planner import PlanGenerateRequest, StudyPlanDay, StudyPlanRead, StudyTaskAction
from app.services.planner import generate_plan, load_plan, replan_remaining

router = APIRouter(prefix="/api/v1/planner", tags=["planner"])


def _validate_move_target(
    plan: StudyPlan,
    task: StudyTask,
    target_date: date,
    daily_capacity: int,
    used_minutes: int,
) -> None:
    if target_date < date.today():
        raise HTTPException(status_code=400, detail="A task cannot be moved to a past date")

    horizon_start = plan.created_at.date()
    horizon_end = horizon_start + timedelta(days=plan.horizon_days - 1)
    if target_date < horizon_start or target_date > horizon_end:
        raise HTTPException(
            status_code=400,
            detail="A task can only be moved within the current study plan horizon. Generate a new plan to use a later date.",
        )

    if task.estimated_minutes > daily_capacity:
        raise HTTPException(
            status_code=400,
            detail="This task is longer than the student's available daily study time.",
        )

    if used_minutes + task.estimated_minutes > daily_capacity:
        raise HTTPException(
            status_code=400,
            detail="The target date does not have enough available study time for this task.",
        )



def _plan_response(plan, tasks) -> dict:
    grouped = defaultdict(list)
    for task in tasks:
        grouped[task.planned_date].append(task)

    days = [
        StudyPlanDay(
            date=day,
            total_minutes=sum(task.estimated_minutes for task in day_tasks),
            tasks=day_tasks,
        )
        for day, day_tasks in sorted(grouped.items())
    ]

    return {
        "id": plan.id,
        "student_id": plan.student_id,
        "horizon_days": plan.horizon_days,
        "created_at": plan.created_at,
        "total_minutes": sum(task.estimated_minutes for task in tasks),
        "days": days,
        "tasks": tasks,
    }


def _tasks_for_plan(db: Session, plan_id: int):
    return list(db.scalars(
        select(StudyTask)
        .where(StudyTask.plan_id == plan_id)
        .order_by(StudyTask.planned_date, StudyTask.priority.desc())
    ).all())


def _generate(db: Session, student_id: int, horizon_days: int) -> StudyPlanRead:
    try:
        plan = generate_plan(db, student_id, horizon_days)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return _plan_response(plan, _tasks_for_plan(db, plan.id))


@router.post("/generate", response_model=StudyPlanRead)
def generate_from_request(
    payload: PlanGenerateRequest,
    db: Session = Depends(get_db),
):
    if payload.student_id is None:
        raise HTTPException(status_code=422, detail="student_id is required")
    return _generate(db, payload.student_id, payload.horizon_days)


@router.post("/students/{student_id}/generate", response_model=StudyPlanRead)
def create_plan(
    student_id: int,
    payload: PlanGenerateRequest,
    db: Session = Depends(get_db),
):
    return _generate(db, student_id, payload.horizon_days)


@router.post("/students/{student_id}/replan", response_model=StudyPlanRead)
def replan_student(
    student_id: int,
    payload: PlanGenerateRequest,
    db: Session = Depends(get_db),
):
    try:
        plan = replan_remaining(db, student_id, horizon_days=payload.horizon_days)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return _plan_response(plan, _tasks_for_plan(db, plan.id))


@router.post("/students/{student_id}/tasks/{task_id}/action", response_model=StudyPlanRead)
def act_on_task(
    student_id: int,
    task_id: int,
    payload: StudyTaskAction,
    db: Session = Depends(get_db),
):
    task = db.scalar(
        select(StudyTask).where(
            StudyTask.id == task_id,
            StudyTask.student_id == student_id,
        )
    )
    if task is None:
        raise HTTPException(status_code=404, detail="Study task not found")

    action = payload.action
    if action == "MOVE":
        if payload.target_date is None:
            raise HTTPException(status_code=400, detail="A target date is required when moving a task")
        if task.status in {"COMPLETED", "SKIPPED"}:
            raise HTTPException(status_code=400, detail="Completed or skipped tasks cannot be moved")

        plan = db.get(StudyPlan, task.plan_id)
        student = db.get(StudentProfile, student_id)
        if plan is None or student is None:
            raise HTTPException(status_code=404, detail="Study plan or student profile not found")

        daily_capacity = int(round(student.study_hours_per_day * 60))
        if task.estimated_minutes > daily_capacity:
            raise HTTPException(
                status_code=400,
                detail="This task is longer than the student's available daily study time.",
            )

        same_day_tasks = list(db.scalars(
            select(StudyTask).where(
                StudyTask.plan_id == task.plan_id,
                StudyTask.planned_date == payload.target_date,
                StudyTask.id != task.id,
                StudyTask.status != "SKIPPED",
            )
        ).all())
        used_minutes = sum(item.estimated_minutes for item in same_day_tasks)
        _validate_move_target(
            plan,
            task,
            payload.target_date,
            daily_capacity,
            used_minutes,
        )

        task.planned_date = payload.target_date
        task.status = "MOVED"

    elif action == "START":
        if task.status == "COMPLETED":
            raise HTTPException(status_code=400, detail="Completed tasks cannot be started again")
        task.status = "IN_PROGRESS"

    elif action == "SKIP":
        if task.status == "COMPLETED":
            raise HTTPException(status_code=400, detail="Completed tasks cannot be skipped")
        task.status = "SKIPPED"

    elif action == "COMPLETE":
        if task.status == "COMPLETED":
            raise HTTPException(status_code=400, detail="This study session is already completed")

        topic = db.get(Topic, task.topic_id)
        if topic is None:
            raise HTTPException(status_code=404, detail="Topic not found")

        progress = db.scalar(
            select(StudentTopicProgress).where(
                StudentTopicProgress.student_id == student_id,
                StudentTopicProgress.topic_id == task.topic_id,
            )
        )
        if progress is None:
            progress = StudentTopicProgress(
                student_id=student_id,
                topic_id=task.topic_id,
                status="IN_PROGRESS",
                confidence=3,
                completed_minutes=0,
                study_sessions=0,
            )
            db.add(progress)
            db.flush()

        progress.completed_minutes += task.estimated_minutes
        progress.study_sessions += 1
        progress.last_studied_at = datetime.now(timezone.utc)
        progress.status = (
            "COMPLETED"
            if progress.completed_minutes >= topic.estimated_study_minutes
            else "IN_PROGRESS"
        )
        task.status = "COMPLETED"

    db.commit()

    if action == "START":
        current = load_plan(db, student_id, task.plan_id)
        if current is None:
            raise HTTPException(status_code=404, detail="Study plan not found")
        return _plan_response(current, _tasks_for_plan(db, current.id))

    try:
        deferred = {task.topic_id} if action == "SKIP" else set()
        pinned = {task.topic_id: task.planned_date} if action == "MOVE" else {}
        plan = replan_remaining(
            db,
            student_id,
            horizon_days=7,
            deferred_topic_ids=deferred,
            pinned_topic_dates=pinned,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return _plan_response(plan, _tasks_for_plan(db, plan.id))


@router.get("/students/{student_id}/latest", response_model=StudyPlanRead)
def latest_plan(student_id: int, db: Session = Depends(get_db)):
    plan = load_plan(db, student_id)
    if not plan:
        raise HTTPException(status_code=404, detail="No study plan has been generated yet")
    return _plan_response(plan, _tasks_for_plan(db, plan.id))
