from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.planner import StudyTask
from app.db.models.student import StudentTopicProgress
from app.db.session import get_db
from app.schemas.planner import (
    PlanGenerateRequest,
    StudyPlanDay,
    StudyPlanRead,
    StudyTaskRead,
    StudyTaskUpdate,
)
from app.services.planner import generate_plan, load_plan

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


@router.post("/generate", response_model=StudyPlanRead)
def generate_from_request(
    payload: PlanGenerateRequest,
    db: Session = Depends(get_db),
):
    if payload.student_id is None:
        raise HTTPException(status_code=422, detail="student_id is required")
    try:
        plan = generate_plan(db, payload.student_id, payload.horizon_days)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    tasks = list(db.scalars(
        select(StudyTask)
        .where(StudyTask.plan_id == plan.id)
        .order_by(StudyTask.planned_date, StudyTask.priority.desc())
    ).all())
    return _plan_response(plan, tasks)


@router.post("/students/{student_id}/generate", response_model=StudyPlanRead)
def create_plan(
    student_id: int,
    payload: PlanGenerateRequest,
    db: Session = Depends(get_db),
):
    try:
        plan = generate_plan(db, student_id, payload.horizon_days)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    tasks = list(db.scalars(
        select(StudyTask)
        .where(StudyTask.plan_id == plan.id)
        .order_by(StudyTask.planned_date, StudyTask.priority.desc())
    ).all())
    return _plan_response(plan, tasks)


@router.get("/students/{student_id}/latest", response_model=StudyPlanRead)
def latest_plan(student_id: int, db: Session = Depends(get_db)):
    plan = load_plan(db, student_id)
    if not plan:
        raise HTTPException(status_code=404, detail="No study plan has been generated yet")
    tasks = list(db.scalars(
        select(StudyTask)
        .where(StudyTask.plan_id == plan.id)
        .order_by(StudyTask.planned_date, StudyTask.priority.desc())
    ).all())
    return _plan_response(plan, tasks)


@router.patch("/students/{student_id}/tasks/{task_id}", response_model=StudyTaskRead)
def update_task(
    student_id: int,
    task_id: int,
    payload: StudyTaskUpdate,
    db: Session = Depends(get_db),
):
    task = db.scalar(select(StudyTask).where(
        StudyTask.id == task_id,
        StudyTask.student_id == student_id,
    ))
    if not task:
        raise HTTPException(status_code=404, detail="Study task not found")

    task.status = payload.status
    if payload.planned_date:
        task.planned_date = payload.planned_date

    if payload.status == "COMPLETED":
        progress = db.scalar(select(StudentTopicProgress).where(
            StudentTopicProgress.student_id == student_id,
            StudentTopicProgress.topic_id == task.topic_id,
        ))
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

    db.commit()
    db.refresh(task)
    return task
