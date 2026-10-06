from app.core.config import API_PREFIX
from app.core.time import today_local
from app.core.deps import require_student_owner
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

router = APIRouter(prefix=f"{API_PREFIX}/havan-planner", tags=["havan-planner"])


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

    if payload.mode in {"week", "month"} and not payload.study_days:
        raise HTTPException(status_code=400, detail="Week and month plans need at least one study day")

    if any(float(hours) <= 0 or float(hours) > 24 for hours in payload.hours_per_day.values()):
        raise HTTPException(status_code=400, detail="Daily study hours must be greater than 0 and no more than 24")

    if sum(int(item.minutes) for item in payload.tasks) != payload.total_minutes:
        raise HTTPException(status_code=400, detail="Plan total_minutes must equal the sum of all topic task minutes")

    today = today_local()
    horizon_end = today + timedelta(days=payload.horizon_days - 1)
    daily_totals: dict[date, int] = {}
    for item in payload.tasks:
        if payload.mode == "today" and item.planned_date != today:
            raise HTTPException(status_code=400, detail="Today plans must contain only today's date")
        if item.planned_date < today or item.planned_date > horizon_end:
            raise HTTPException(status_code=400, detail="Every planned task must stay inside the selected plan horizon")
        if payload.mode in {"week", "month"} and item.planned_date.weekday() not in payload.study_days:
            raise HTTPException(status_code=400, detail="A week or month task must be placed on a selected study day")
        daily_totals[item.planned_date] = daily_totals.get(item.planned_date, 0) + item.minutes
        topic = db.get(Topic, item.topic_id)
        if topic is None or str(topic.status).upper() != "ACTIVE":
            raise HTTPException(status_code=400, detail=f"Topic {item.topic_id} is not active")
        chapter = db.get(Chapter, topic.chapter_id)
        if chapter is None or chapter.course_id != item.course_id:
            raise HTTPException(status_code=400, detail=f"Topic {item.topic_id} does not belong to course {item.course_id}")

    if payload.mode in {"week", "month"}:
        for planned_date, minutes in daily_totals.items():
            allowed = float(payload.hours_per_day.get(planned_date.weekday(), 0)) * 60
            if minutes > allowed:
                raise HTTPException(status_code=400, detail=f"Tasks on {planned_date.isoformat()} exceed the available study time")


@router.post("/students/{student_id}/plans", dependencies=[Depends(require_student_owner)], response_model=HavanPlanRead)
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


@router.get("/students/{student_id}/latest", dependencies=[Depends(require_student_owner)], response_model=HavanPlanRead)
def latest_plan(student_id: int, db: Session = Depends(get_db)):
    plan = db.scalar(select(HavanPlan).where(HavanPlan.student_id == student_id).order_by(HavanPlan.id.desc()))
    if plan is None:
        raise HTTPException(status_code=404, detail="No Havan plan found")
    tasks = list(db.scalars(select(HavanPlanTask).where(HavanPlanTask.plan_id == plan.id).order_by(HavanPlanTask.planned_date, HavanPlanTask.id)).all())
    return _read(plan, tasks)
