from fastapi import APIRouter, Depends

from app.core.errors import DomainError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import API_PREFIX
from app.core.deps import current_student
from app.db.models.plan import Plan
from app.db.models.student import StudentProfile
from app.db.session import get_db
from app.schemas.plan import PlanAction, PlanInput, PlanOut
from app.services.plan_actions import apply_action
from app.services.plan_builder import preview_plan, read_plan, save_plan

router = APIRouter(prefix=f"{API_PREFIX}/plans", tags=["plans"])


@router.post("/preview", response_model=PlanOut)
def preview(
    payload: PlanInput,
    student: StudentProfile = Depends(current_student),
    db: Session = Depends(get_db),
):
    try:
        return preview_plan(db, student, payload)
    except ValueError as exc:
        raise DomainError("INVALID_SELECTION", str(exc), 422)


@router.post("", response_model=PlanOut)
def create(
    payload: PlanInput,
    student: StudentProfile = Depends(current_student),
    db: Session = Depends(get_db),
):
    try:
        return save_plan(db, student, payload)
    except ValueError as exc:
        raise DomainError("INVALID_SELECTION", str(exc), 422)


@router.get("/current", response_model=PlanOut)
def current(
    student: StudentProfile = Depends(current_student),
    db: Session = Depends(get_db),
):
    plan = db.scalar(select(Plan).where(Plan.student_id == student.id, Plan.status == "ACTIVE").order_by(Plan.id.desc()))
    if not plan:
        raise DomainError("NO_ACTIVE_PLAN", "You do not have a plan yet. Choose what to study and Havan will organize it.", 404)
    return read_plan(db, student, plan)


@router.post("/current/tasks/{task_id}/actions", response_model=PlanOut)
def current_action(
    task_id: int,
    payload: PlanAction,
    student: StudentProfile = Depends(current_student),
    db: Session = Depends(get_db),
):
    plan = db.scalar(select(Plan).where(
        Plan.student_id == student.id,
        Plan.status == "ACTIVE",
    ).order_by(Plan.id.desc()))
    if not plan:
        raise DomainError("NO_ACTIVE_PLAN", "You do not have a plan yet.", 404)
    try:
        result, warnings = apply_action(db, student, task_id, payload)
        out = read_plan(db, student, result)
        if warnings:
            out.warnings.extend([
                {"code": code, "severity": "info", "message": code, "fix": {}}
                for code in warnings
            ])
        return out
    except ValueError as exc:
        raise DomainError("INVALID_SELECTION", str(exc), 422)


@router.post("/{plan_id}/tasks/{task_id}/actions", response_model=PlanOut)
def action(
    plan_id: int,
    task_id: int,
    payload: PlanAction,
    student: StudentProfile = Depends(current_student),
    db: Session = Depends(get_db),
):
    plan = db.scalar(select(Plan).where(Plan.id == plan_id, Plan.student_id == student.id, Plan.status == "ACTIVE"))
    if not plan:
        raise DomainError("NO_ACTIVE_PLAN", "Study plan not found.", 404)
    try:
        result, warnings = apply_action(db, student, task_id, payload)
        out = read_plan(db, student, result)
        for code in warnings:
            out.warnings.append({"code": code, "severity": "info", "message": code, "fix": {}})
        return out
    except ValueError as exc:
        raise DomainError("INVALID_SELECTION", str(exc), 422)


