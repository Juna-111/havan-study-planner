from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import API_PREFIX
from app.core.deps import current_student
from app.core.errors import DomainError, PlanValidationError
from app.core.time import today_local
from app.db.models.curriculum import Chapter, HavanPromotion, Topic
from app.db.models.plan import Plan
from app.db.models.student import StudentProfile
from app.db.session import get_db
from app.schemas.havan_planner import (
    HavanPlanCreate,
    HavanPlanRead,
    HavanPlanTaskAction,
    HavanPlanTaskRead,
    HavanPromotionRead,
)
from app.schemas.plan import PlanAction, PlanInput
from app.services.plan_actions import apply_action
from app.services.plan_builder import preview_plan, read_plan, save_plan

router = APIRouter(prefix=f"{API_PREFIX}/havan-planner", tags=["havan-planner"])
_WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def _to_plan_input(payload: HavanPlanCreate, *, today=None) -> PlanInput:
    today = today or today_local()
    expected = {"today": 1, "week": 7, "month": 28}[payload.mode]
    if payload.horizon_days != expected:
        raise DomainError("INVALID_SELECTION", "The selected plan mode and horizon do not match.", 422)

    study_days = []
    minutes_by_weekday = {}
    for day in payload.study_days:
        if day < 0 or day > 6:
            raise DomainError("INVALID_SELECTION", "Study days must use values from 0 to 6.", 422)
        weekday = _WEEKDAYS[day]
        study_days.append(weekday)
        minutes = round(float(payload.hours_per_day.get(day, 0)) * 60)
        if minutes <= 0:
            raise DomainError("INVALID_SELECTION", "Every selected study day needs a valid daily study time.", 422)
        minutes_by_weekday[weekday] = minutes

    if payload.mode == "today":
        if today.weekday() not in payload.study_days:
            raise PlanValidationError(
                "NO_STUDY_DAYS",
                "For a Today plan, select today as a study day so Havan knows when to place your time.",
                422,
            )
        weekday = _WEEKDAYS[today.weekday()]
        minutes = round(float(payload.hours_per_day.get(today.weekday(), 0)) * 60)
        if minutes <= 0:
            raise PlanValidationError(
                "NO_STUDY_DAYS",
                "Set a study time for today before building the Today plan.",
                422,
            )
        study_days = [weekday]
        minutes_by_weekday = {weekday: minutes}

    return PlanInput(
        mode=payload.mode,
        horizon_days=payload.horizon_days,
        topic_ids=payload.topic_ids,
        study_days=list(dict.fromkeys(study_days)),
        minutes_by_weekday=minutes_by_weekday,
        hours_per_day=max(payload.hours_per_day.values(), default=0.0),
    )


def _read_havan_from_out(
    db: Session,
    student: StudentProfile,
    out,
    *,
    plan_id: int | None,
    input_snapshot: dict,
) -> HavanPlanRead:
    topic_ids = {task.topic_id for task in out.tasks}
    topics = list(db.scalars(select(Topic).where(Topic.id.in_(topic_ids))).all()) if topic_ids else []
    topic_map = {topic.id: topic for topic in topics}
    chapter_ids = {topic.chapter_id for topic in topics}
    chapters = list(db.scalars(select(Chapter).where(Chapter.id.in_(chapter_ids))).all()) if chapter_ids else []
    chapter_map = {chapter.id: chapter for chapter in chapters}

    tasks = []
    for task in out.tasks:
        topic = topic_map.get(task.topic_id)
        chapter = chapter_map.get(topic.chapter_id) if topic else None
        if not topic or not chapter:
            continue
        promotions = db.scalars(
            select(HavanPromotion).where(
                ((HavanPromotion.chapter_id == chapter.id) | (HavanPromotion.topic_id == topic.id)),
                func.upper(HavanPromotion.status) == "ACTIVE",
            ).order_by(HavanPromotion.order_index, HavanPromotion.id)
        ).all()
        tasks.append(HavanPlanTaskRead(
            id=task.id or 0,
            course_id=task.course_id,
            course_code=task.course_code,
            course_name=task.course_name,
            chapter_name=task.chapter_name,
            topic_id=task.topic_id,
            topic_name=task.topic_name,
            planned_date=task.planned_date,
            minutes=task.minutes,
            important_points=topic.important_points,
            promotions=[HavanPromotionRead.model_validate({
                "id": p.id,
                "platform_name": p.platform_name,
                "description": p.description,
                "button_text": p.button_text,
                "url": p.url,
                "status": p.status,
            }) for p in promotions],
            status=task.status,
        ))

    snapshot = PlanInput.model_validate(input_snapshot)
    study_days = [_WEEKDAYS.index(day) for day in snapshot.study_days]
    hours = {
        i: round(float(snapshot.minutes_by_weekday.get(_WEEKDAYS[i], 0)) / 60, 2)
        for i in study_days
    }
    return HavanPlanRead(
        id=plan_id,
        student_id=student.id,
        mode=out.mode,
        horizon_days=out.horizon_days,
        study_days=study_days,
        hours_per_day=hours,
        total_minutes=out.total_minutes,
        tasks=tasks,
        warnings=out.warnings,
        unplaced=out.unplaced,
    )


def _read_havan(db: Session, student: StudentProfile, plan: Plan) -> HavanPlanRead:
    out = read_plan(db, student, plan)
    return _read_havan_from_out(
        db, student, out,
        plan_id=plan.id,
        input_snapshot=plan.input_snapshot,
    )


@router.post("/me/preview", response_model=HavanPlanRead)
def preview_current_plan(
    payload: HavanPlanCreate,
    student: StudentProfile = Depends(current_student),
    db: Session = Depends(get_db),
):
    plan_input = _to_plan_input(payload)
    try:
        out = preview_plan(db, student, plan_input, today=today_local())
        return _read_havan_from_out(
            db, student, out,
            plan_id=None,
            input_snapshot=plan_input.model_dump(mode="json"),
        )
    except PlanValidationError:
        raise


@router.post("/me/plans", response_model=HavanPlanRead)
def create_current_plan(
    payload: HavanPlanCreate,
    student: StudentProfile = Depends(current_student),
    db: Session = Depends(get_db),
):
    try:
        plan = save_plan(db, student, _to_plan_input(payload), today=today_local())
        return _read_havan(db, student, plan)
    except PlanValidationError:
        raise


@router.get("/me/latest", response_model=HavanPlanRead)
def latest_current_plan(
    student: StudentProfile = Depends(current_student),
    db: Session = Depends(get_db),
):
    plan = db.scalar(
        select(Plan).where(
            Plan.student_id == student.id,
            Plan.status == "ACTIVE",
        ).order_by(Plan.id.desc())
    )
    if plan is None:
        raise DomainError("NO_ACTIVE_PLAN", "No Havan plan found.", 404)
    return _read_havan(db, student, plan)


@router.post("/me/plans/{plan_id}/tasks/{task_id}/actions", response_model=HavanPlanRead)
def action_current_task(
    plan_id: int,
    task_id: int,
    payload: HavanPlanTaskAction,
    student: StudentProfile = Depends(current_student),
    db: Session = Depends(get_db),
):
    plan = db.scalar(select(Plan).where(
        Plan.id == plan_id,
        Plan.student_id == student.id,
        Plan.status == "ACTIVE",
    ))
    if plan is None:
        raise DomainError("NO_ACTIVE_PLAN", "Study plan not found.", 404)
    try:
        result, _ = apply_action(db, student, task_id, PlanAction(action=payload.action), plan_id=plan.id)
        return _read_havan(db, student, result)
    except PlanValidationError:
        raise
