import json
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.curriculum import Chapter, Topic
from app.db.models.havan_planner import HavanPlan, HavanPlanSelection, HavanPlanTask
from app.db.models.student import StudentProfile
from app.db.session import get_db
from app.schemas.havan_planner import HavanPlanCreate, HavanPlanRead, HavanPlanTaskRead

router = APIRouter(prefix="/api/v1/havan-planner", tags=["havan-planner"])


def _read(plan: HavanPlan, tasks: list[HavanPlanTask]) -> HavanPlanRead:
    return HavanPlanRead(
        id=plan.id,
        student_id=plan.student_id,
        mode=plan.mode,
        horizon_days=plan.horizon_days,
        study_days=[int(x) for x in plan.study_days.split(",") if x != ""],
        hours_per_day={int(k): float(v) for k, v in json.loads(plan.hours_per_day_json or "{}").items()},
        total_minutes=plan.total_minutes,
        tasks=[HavanPlanTaskRead.model_validate(t, from_attributes=True) for t in tasks],
    )


def _validate_tasks(db: Session, student_id: int, payload: HavanPlanCreate) -> None:
    if db.get(StudentProfile, student_id) is None:
        raise HTTPException(status_code=404, detail="Student profile not found")

    expected_horizon = {"today": 1, "week": 7, "month": 28}[payload.mode]
    if payload.horizon_days != expected_horizon:
        raise HTTPException(status_code=400, detail="The selected plan mode and horizon do not match")

    if any(day < 0 or day > 6 for day in payload.study_days):
        raise HTTPException(status_code=400, detail="Study days must use weekday values from 0 to 6")

    if any(float(hours) <= 0 or float(hours) > 24 for hours in payload.hours_per_day.values()):
        raise HTTPException(status_code=400, detail="Daily study hours must be greater than 0 and no more than 24")

    if sum(int(item.minutes) for item in payload.tasks) != payload.total_minutes:
        raise HTTPException(status_code=400, detail="Plan total_minutes must equal the sum of all topic task minutes")

    today = date.today()
    horizon_end = today + timedelta(days=payload.horizon_days - 1)
    for item in payload.tasks:
        if payload.mode == "today" and item.planned_date != today:
            raise HTTPException(status_code=400, detail="Today plans must contain only today's date")
        if item.planned_date < today or item.planned_date > horizon_end:
            raise HTTPException(status_code=400, detail="Every planned task must stay inside the selected plan horizon")
        topic = db.get(Topic, item.topic_id)
        if topic is None or str(topic.status).upper() != "ACTIVE":
            raise HTTPException(status_code=400, detail=f"Topic {item.topic_id} is not active")
        chapter = db.get(Chapter, topic.chapter_id)
        if chapter is None or chapter.course_id != item.course_id:
            raise HTTPException(status_code=400, detail=f"Topic {item.topic_id} does not belong to course {item.course_id}")


@router.post("/students/{student_id}/plans", response_model=HavanPlanRead)
def create_plan(student_id: int, payload: HavanPlanCreate, db: Session = Depends(get_db)):
    _validate_tasks(db, student_id, payload)

    plan = HavanPlan(
        student_id=student_id,
        mode=payload.mode,
        horizon_days=payload.horizon_days,
        study_days=",".join(str(x) for x in sorted(set(payload.study_days))),
        hours_per_day_json=json.dumps({str(k): v for k, v in payload.hours_per_day.items()}),
        total_minutes=payload.total_minutes,
    )
    db.add(plan)
    db.flush()

    for item in payload.tasks:
        db.add(HavanPlanSelection(plan_id=plan.id, course_id=item.course_id, topic_id=item.topic_id, course_minutes=item.minutes))
        db.add(HavanPlanTask(
            plan_id=plan.id,
            course_id=item.course_id,
            topic_id=item.topic_id,
            planned_date=item.planned_date,
            minutes=item.minutes,
        ))

    db.commit()
    db.refresh(plan)
    tasks = list(db.scalars(select(HavanPlanTask).where(HavanPlanTask.plan_id == plan.id).order_by(HavanPlanTask.planned_date, HavanPlanTask.id)).all())
    return _read(plan, tasks)


@router.get("/students/{student_id}/latest", response_model=HavanPlanRead)
def latest_plan(student_id: int, db: Session = Depends(get_db)):
    plan = db.scalar(select(HavanPlan).where(HavanPlan.student_id == student_id).order_by(HavanPlan.id.desc()))
    if plan is None:
        raise HTTPException(status_code=404, detail="No Havan plan found")
    tasks = list(db.scalars(select(HavanPlanTask).where(HavanPlanTask.plan_id == plan.id).order_by(HavanPlanTask.planned_date, HavanPlanTask.id)).all())
    return _read(plan, tasks)
