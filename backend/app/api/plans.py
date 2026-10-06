from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import API_PREFIX
from app.core.deps import current_student
from app.db.models.plan import Plan, PlanTask
from app.db.models.student import StudentProfile
from app.db.session import get_db
from app.schemas.plan import PlanAction, PlanInput, PlanOut
from app.services.plan_actions import apply_action
from app.services.plan_builder import preview_plan, save_plan

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
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("", response_model=PlanOut)
def create(
    payload: PlanInput,
    student: StudentProfile = Depends(current_student),
    db: Session = Depends(get_db),
):
    try:
        return save_plan(db, student, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/current", response_model=PlanOut)
def current(
    student: StudentProfile = Depends(current_student),
    db: Session = Depends(get_db),
):
    plan = db.scalar(
        select(Plan).where(Plan.student_id == student.id, Plan.status == "ACTIVE")
        .order_by(Plan.id.desc())
    )
    if not plan:
        raise HTTPException(status_code=404, detail="You do not have a plan yet. Choose what to study and Havan will organize it.")
    snapshot = PlanInput.model_validate(plan.input_snapshot)
    try:
        return save_snapshot_response(db, student, plan, snapshot)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


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
        raise HTTPException(status_code=404, detail="Study plan not found.")
    try:
        result, warning = apply_action(db, student, task_id, payload)
        if isinstance(result, PlanOut):
            return result
        snapshot = PlanInput.model_validate(result.input_snapshot)
        return save_snapshot_response(db, student, result, snapshot, extra_warning=warning)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def save_snapshot_response(
    db: Session,
    student: StudentProfile,
    plan: Plan,
    snapshot: PlanInput,
    extra_warning: str | None = None,
) -> PlanOut:
    from app.services.plan_builder import _result_to_out
    from app.services.plan_adapter import build_request
    from app.services.planner_engine import build_plan

    deferred = {
        task.topic_id for task in db.scalars(
            select(PlanTask).where(
                __import__("app.db.models.plan", fromlist=["PlanTask"]).PlanTask.plan_id == plan.id,
                __import__("app.db.models.plan", fromlist=["PlanTask"]).PlanTask.status == "SKIPPED",
            )
        ).all()
    }
    pins = {
        task.topic_id: task.planned_date for task in db.scalars(
            select(__import__("app.db.models.plan", fromlist=["PlanTask"]).PlanTask).where(
                __import__("app.db.models.plan", fromlist=["PlanTask"]).PlanTask.plan_id == plan.id,
                __import__("app.db.models.plan", fromlist=["PlanTask"]).PlanTask.pinned.is_(True),
            )
        ).all()
    }
    request = build_request(db, student, snapshot, deferred_topic_ids=deferred, pinned_topic_dates=pins)
    result = build_plan(request)
    out = _result_to_out(db, student, snapshot, result, plan)
    if extra_warning:
        out.warnings.append({
            "code": extra_warning,
            "severity": "info",
            "message": "Skipped. Tap Rebuild the rest to place it later.",
            "fix": {"rebuild": "Rebuild the rest"},
        })
    return out
