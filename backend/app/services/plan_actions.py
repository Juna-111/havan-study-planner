from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.time import today_local, to_index
from app.core.errors import PlanValidationError
from app.db.models.curriculum import Chapter, Course, Topic
from app.db.models.plan import Plan, PlanTask
from app.db.models.student import StudentProfile, StudentTopicProgress
from app.schemas.plan import PlanAction, PlanInput
from app.services.plan.engine import blend_confidence
from app.services.academic_resolver import resolved_course_ids
from app.services.plan_builder import build_student_choice_result, read_plan


def _active_plan(db: Session, student_id: int) -> Plan:
    plan = db.scalar(
        select(Plan)
        .where(Plan.student_id == student_id, Plan.status == "ACTIVE")
        .order_by(Plan.id.desc())
    )
    if not plan:
        raise PlanValidationError("NO_ACTIVE_PLAN", "You do not have a plan yet. Choose what to study and Havan will organize it.", 422)
    return plan


def _input_from_snapshot(plan: Plan) -> PlanInput:
    return PlanInput.model_validate(plan.input_snapshot)


def _rebuild_future(
    db: Session,
    student: StudentProfile,
    plan: Plan,
    snapshot: PlanInput,
    deferred_topic_ids: set[int],
) -> Plan:
    today = today_local()
    window_end = plan.start_date + timedelta(days=plan.horizon_days - 1)
    planning_start = max(today, plan.start_date)
    preserved_pins = {
        row.topic_id: row.planned_date
        for row in db.scalars(
            select(PlanTask).where(
                PlanTask.plan_id == plan.id,
                PlanTask.pinned.is_(True),
                PlanTask.status != "SKIPPED",
                PlanTask.planned_date >= planning_start,
                PlanTask.planned_date <= window_end,
            )
        ).all()
    }
    preserved_topic_ids = set(preserved_pins)
    future_snapshot_pins = {
        topic_id: pinned_date
        for topic_id, pinned_date in snapshot.pinned_topic_dates.items()
        if planning_start <= pinned_date <= window_end
    }
    future_snapshot_pins.update(preserved_pins)
    rebuilt_input = snapshot.model_copy(update={
        "pinned_topic_dates": future_snapshot_pins,
    })
    result = build_student_choice_result(
        db,
        student,
        rebuilt_input,
        deferred_topic_ids=deferred_topic_ids,
        pinned_topic_dates=preserved_pins,
        frozen_topic_ids=preserved_topic_ids,
        today=planning_start,
    )

    future_rows = db.scalars(
        select(PlanTask).where(
            PlanTask.plan_id == plan.id,
            PlanTask.planned_date >= planning_start,
            PlanTask.planned_date <= window_end,
            PlanTask.status == "PLANNED",
            PlanTask.pinned.is_(False),
        )
    ).all()
    for row in future_rows:
        db.delete(row)

    for session in result.sessions:
        if session.topic_id in preserved_topic_ids:
            continue
        db.add(PlanTask(
            plan_id=plan.id,
            student_id=student.id,
            course_id=session.course_id,
            topic_id=session.topic_id,
            planned_date=session.planned_date,
            minutes=session.minutes,
            priority=session.priority,
            reason=session.reason,
            reason_parts=[list(part) for part in session.reason_parts],
            kind=session.kind,
            status="PLANNED",
            pinned=session.topic_id in rebuilt_input.pinned_topic_dates,
        ))

    plan.total_minutes = sum(
        row.minutes
        for row in db.scalars(select(PlanTask).where(PlanTask.plan_id == plan.id)).all()
        if row.status != "SKIPPED"
    )
    plan.readiness = [
        {
            "course_id": item.course_id,
            "exam_type": item.exam_type,
            "exam_date": item.exam_date.isoformat(),
            "days_left": item.days_left,
            "status": item.status,
            "required_minutes": item.required_minutes,
            "available_minutes": item.available_minutes,
            "shortfall_minutes": item.shortfall_minutes,
            "extra_minutes_per_study_day": item.extra_minutes_per_study_day,
        }
        for item in result.readiness
    ]
    plan.warnings = [{"code": item.code, "message": item.message} for item in result.warnings]
    plan.unplaced = [
        {
            "topic_id": item.topic_id,
            "topic_name": item.topic_name,
            "course_id": item.course_id,
            "minutes": item.remaining_minutes,
            "reason_code": item.reason_code,
        }
        for item in result.unplaced
    ]
    plan.input_snapshot = rebuilt_input.model_dump(mode="json")
    db.commit()
    db.refresh(plan)
    return plan


def _validate_target_date(plan: Plan, target: date) -> None:
    if not (plan.start_date <= target <= plan.start_date + timedelta(days=plan.horizon_days - 1)):
        raise PlanValidationError("PIN_OUTSIDE_WINDOW", "Choose a date inside this plan's planning window.", 422)

def apply_action(
    db: Session,
    student: StudentProfile,
    task_id: int,
    payload: PlanAction,
    *,
    plan_id: int | None = None,
) -> tuple[Plan, list[str]]:
    plan = (
        db.scalar(select(Plan).where(
            Plan.id == plan_id,
            Plan.student_id == student.id,
            Plan.status == "ACTIVE",
        ))
        if plan_id is not None
        else _active_plan(db, student.id)
    )
    if not plan:
        raise PlanValidationError("PLAN_NOT_FOUND", "Study plan not found.", 422)
    task = db.scalar(
        select(PlanTask).where(
            PlanTask.id == task_id,
            PlanTask.plan_id == plan.id,
            PlanTask.student_id == student.id,
        )
    )

    if payload.action == "ADD" and task_id == 0:
        if payload.target_topic_id is None:
            raise PlanValidationError("TOPIC_UNAVAILABLE", "Choose a topic to add.", 422)
        topic = db.get(Topic, payload.target_topic_id)
        if not topic or str(topic.status).upper() != "ACTIVE":
            raise PlanValidationError("TOPIC_UNAVAILABLE", "The selected topic is not active.", 422)
        chapter = db.get(Chapter, topic.chapter_id)
        if chapter is None or chapter.course_id not in resolved_course_ids(db, student.id):
            raise PlanValidationError("TOPIC_OUT_OF_CURRICULUM", "The selected topic is outside your active curriculum.", 422)
        snapshot = _input_from_snapshot(plan)
        if topic.id in snapshot.topic_ids:
            raise PlanValidationError("TOPIC_UNAVAILABLE", "That topic is already part of this plan.", 422)
        target = payload.target_date or today_local()
        _validate_target_date(plan, target)
        weekday_names = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
        weekday = weekday_names[target.weekday()]
        if weekday not in snapshot.study_days:
            raise PlanValidationError("NO_STUDY_DAYS", "Choose one of your study days.", 422)
        daily_limit = int(snapshot.minutes_by_weekday.get(weekday, snapshot.hours_per_day * 60))
        used_minutes = sum(
            row.minutes
            for row in db.scalars(
                select(PlanTask).where(
                    PlanTask.plan_id == plan.id,
                    PlanTask.planned_date == target,
                    PlanTask.status != "SKIPPED",
                )
            ).all()
        )
        available = max(0, daily_limit - used_minutes)
        if available < 5:
            raise PlanValidationError("NO_STUDY_TIME", "There is no available study time on that date.", 422)
        minutes = min(20, max(5, topic.estimated_study_minutes), available)
        if minutes < 5:
            raise PlanValidationError("NO_STUDY_TIME", "There is no available study time on that date.", 422)
        db.add(PlanTask(
            plan_id=plan.id,
            student_id=student.id,
            course_id=chapter.course_id,
            topic_id=topic.id,
            planned_date=target,
            minutes=minutes,
            priority=0,
            reason="You added this topic to your plan.",
            reason_parts=[["manual_add", {}]],
            kind="STUDY",
            status="PLANNED",
            pinned=True,
        ))
        plan.input_snapshot = snapshot.model_copy(update={
            "topic_ids": list(dict.fromkeys(snapshot.topic_ids + [topic.id])),
            "pinned_topic_dates": {**snapshot.pinned_topic_dates, topic.id: target},
        }).model_dump(mode="json")
        db.commit()
        db.refresh(plan)
        return plan, []

    if not task:
        raise PlanValidationError("TASK_NOT_FOUND", "Study task not found.", 422)

    if task.status == "DONE" and payload.action == "COMPLETE":
        return plan, []
    if task.status == "DONE" and payload.action != "REPEAT":
        raise PlanValidationError("INVALID_ACTION", "A completed task can only be repeated.", 422)

    if payload.action == "START":
        if task.status not in {"PLANNED", "IN_PROGRESS"}:
            raise PlanValidationError("INVALID_ACTION", "This task cannot be started.", 422)
        task.status = "IN_PROGRESS"
        db.commit()
        return plan, []

    if payload.action == "COMPLETE":
        topic = db.get(Topic, task.topic_id)
        if not topic:
            raise PlanValidationError("TOPIC_UNAVAILABLE", "Topic not found.", 422)
        actual = payload.actual_minutes or task.minutes
        progress = db.scalar(select(StudentTopicProgress).where(
            StudentTopicProgress.student_id == student.id,
            StudentTopicProgress.topic_id == task.topic_id,
        ))
        if not progress:
            progress = StudentTopicProgress(
                student_id=student.id,
                topic_id=task.topic_id,
                status="IN_PROGRESS",
                confidence=3,
                completed_minutes=0,
                study_sessions=0,
            )
            db.add(progress)
            db.flush()
        progress.completed_minutes += actual
        progress.study_sessions += 1
        progress.last_studied_at = datetime.now(timezone.utc)
        if payload.confidence is not None:
            progress.confidence = blend_confidence(progress.confidence, payload.confidence)
        progress.status = (
            "COMPLETED"
            if progress.completed_minutes >= topic.estimated_study_minutes
            else "IN_PROGRESS"
        )
        task.actual_minutes = actual
        task.confidence = payload.confidence
        task.status = "DONE"
        task.completed_at = datetime.now(timezone.utc)
        db.commit()
        return plan, []

    if payload.action == "SKIP":
        task.status = "SKIPPED"
        db.commit()
        if payload.rebuild:
            snapshot = _input_from_snapshot(plan)
            return _rebuild_future(db, student, plan, snapshot, {task.topic_id}), []
        return plan, ["SKIPPED_NEEDS_REBUILD"]

    if payload.action == "MOVE":
        if payload.target_date is None:
            raise PlanValidationError("PIN_OUTSIDE_WINDOW", "Choose a date for this task.", 422)
        _validate_target_date(plan, payload.target_date)
        task.planned_date = payload.target_date
        task.pinned = True
        task.status = "PLANNED"
        warnings: list[str] = []
        if payload.target_date.weekday() not in {to_index(day) for day in _input_from_snapshot(plan).study_days}:
            warnings.append("PIN_NON_STUDY_DAY")
        snapshot = _input_from_snapshot(plan)
        snapshot = snapshot.model_copy(update={
            "pinned_topic_dates": {**snapshot.pinned_topic_dates, task.topic_id: payload.target_date},
        })
        plan.input_snapshot = snapshot.model_dump(mode="json")
        weekday_key = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")[payload.target_date.weekday()]
        configured_capacity = snapshot.minutes_by_weekday.get(
            weekday_key,
            max(5, round(snapshot.hours_per_day * 60 / 5) * 5),
        )
        used = sum(
            row.minutes
            for row in db.scalars(
                select(PlanTask).where(
                    PlanTask.plan_id == plan.id,
                    PlanTask.planned_date == payload.target_date,
                    PlanTask.id != task.id,
                    PlanTask.status != "SKIPPED",
                )
            ).all()
        )
        if used + task.minutes > configured_capacity:
            warnings.append("MOVE_OVER_CAPACITY")
        db.commit()
        return plan, warnings

    if payload.action == "REPEAT":
        target = payload.target_date or task.planned_date
        _validate_target_date(plan, target)
        db.add(PlanTask(
            plan_id=plan.id,
            student_id=student.id,
            course_id=task.course_id,
            topic_id=task.topic_id,
            planned_date=target,
            minutes=20,
            priority=task.priority,
            reason="You chose to review this topic again.",
            reason_parts=[["manual_repeat", {}]],
            kind="REVIEW",
            status="PLANNED",
            pinned=False,
        ))
        db.commit()
        return plan, []

    if payload.action == "REMOVE":
        if task.status != "PLANNED":
            raise PlanValidationError("INVALID_ACTION", "Only planned work can be removed.", 422)
        topic = db.get(Topic, task.topic_id)
        existing = {item.get("topic_id") for item in plan.unplaced}
        if task.topic_id not in existing:
            plan.unplaced = list(plan.unplaced) + [{
                "topic_id": task.topic_id,
                "topic_name": topic.name if topic else "Selected topic",
                "course_id": task.course_id,
                "minutes": task.minutes,
                "reason_code": "removed",
            }]
        snapshot = _input_from_snapshot(plan)
        snapshot = snapshot.model_copy(update={
            "topic_ids": [topic_id for topic_id in snapshot.topic_ids if topic_id != task.topic_id],
            "pinned_topic_dates": {
                topic_id: planned_date
                for topic_id, planned_date in snapshot.pinned_topic_dates.items()
                if topic_id != task.topic_id
            },
        })
        plan.input_snapshot = snapshot.model_dump(mode="json")
        db.delete(task)
        db.commit()
        return plan, []

    raise ValueError("Unsupported plan action.")
