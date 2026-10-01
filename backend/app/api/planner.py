from collections import defaultdict
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.planner import StudyTask
from app.db.models.student import StudentTopicProgress
from app.db.session import get_db
from app.schemas.planner import PlanGenerateRequest, StudyPlanDay, StudyPlanRead, StudyTaskAction, StudyTaskRead
from app.services.planner import generate_plan, load_plan, replan_remaining

router = APIRouter(prefix="/api/v1/planner", tags=["planner"])


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


def _plan_by_id(db: Session, plan_id: int) -> StudyPlanRead:
    plan = db.get(__import__("app.db.models.planner", fromlist=["StudyPlan"]).StudyPlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Study plan not found")
    return _plan_response(plan, _tasks_for_plan(db, plan.id))


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
        if payload.target_date < date.today():
            raise HTTPException(status_code=400, detail="A task cannot be moved to a past date")
        task.planned_date = payload.target_date
        task.status = "RECOMMENDED"

    elif action == "START":
        if task.status == "COMPLETED":
            raise HTTPException(status_code=400, detail="Completed tasks cannot be started again")
        task.status = "IN_PROGRESS"

    elif action == "SKIP":
        if task.status == "COMPLETED":
            raise HTTPException(status_code=400, detail="Completed tasks cannot be skipped")
        task.status = "SKIPPED"

    elif action == "COMPLETE":
        task.status = "COMPLETED"
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
                status="COMPLETED",
                confidence=3,
            )
            db.add(progress)
        else:
            progress.status = "COMPLETED"
            progress.last_studied_at = datetime.now(timezone.utc)

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
