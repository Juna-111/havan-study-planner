from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.planner import StudyTask
from app.db.models.student import StudentTopicProgress
from app.db.session import get_db
from app.schemas.planner import PlanGenerateRequest, StudyPlanRead, StudyTaskRead, StudyTaskUpdate
from app.services.planner import generate_plan, load_plan

router = APIRouter(prefix="/api/v1/planner", tags=["planner"])


@router.post("/students/{student_id}/generate", response_model=StudyPlanRead)
def create_plan(student_id: int, payload: PlanGenerateRequest, db: Session = Depends(get_db)):
    try:
        plan = generate_plan(db, student_id, payload.horizon_days)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    tasks = list(db.scalars(select(StudyTask).where(StudyTask.plan_id == plan.id).order_by(StudyTask.planned_date, StudyTask.priority.desc())).all())
    return {"id": plan.id, "student_id": plan.student_id, "horizon_days": plan.horizon_days, "created_at": plan.created_at, "tasks": tasks}


@router.get("/students/{student_id}/latest", response_model=StudyPlanRead)
def latest_plan(student_id: int, db: Session = Depends(get_db)):
    plan = load_plan(db, student_id)
    if not plan:
        raise HTTPException(status_code=404, detail="No study plan has been generated yet")
    tasks = list(db.scalars(select(StudyTask).where(StudyTask.plan_id == plan.id).order_by(StudyTask.planned_date, StudyTask.priority.desc())).all())
    return {"id": plan.id, "student_id": plan.student_id, "horizon_days": plan.horizon_days, "created_at": plan.created_at, "tasks": tasks}


@router.patch("/students/{student_id}/tasks/{task_id}", response_model=StudyTaskRead)
def update_task(student_id: int, task_id: int, payload: StudyTaskUpdate, db: Session = Depends(get_db)):
    task = db.scalar(select(StudyTask).where(StudyTask.id == task_id, StudyTask.student_id == student_id))
    if not task:
        raise HTTPException(status_code=404, detail="Study task not found")
    task.status = payload.status
    if payload.planned_date:
        task.planned_date = payload.planned_date

    # Keep planner actions and academic progress synchronized.
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
