from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.time import today_local
from app.db.models.curriculum import Topic
from app.db.models.plan import Plan, PlanTask
from app.db.models.student import StudentProfile, StudentTopicProgress
from app.schemas.plan import PlanAction, PlanInput
from app.services.plan_builder import save_plan
from app.services.plan.engine import blend_confidence


def _active_plan(db: Session, student_id: int) -> Plan:
    plan = db.scalar(
        select(Plan).where(Plan.student_id == student_id, Plan.status == "ACTIVE")
        .order_by(Plan.id.desc())
    )
    if not plan:
        raise ValueError("You do not have a plan yet. Choose what to study and Havan will organize it.")
    return plan


def _input_from_snapshot(plan: Plan) -> PlanInput:
    return PlanInput.model_validate(plan.input_snapshot)


def apply_action(
    db: Session,
    student: StudentProfile,
    task_id: int,
    payload: PlanAction,
):
    plan = _active_plan(db, student.id)
    task = db.scalar(
        select(PlanTask).where(
            PlanTask.id == task_id,
            PlanTask.plan_id == plan.id,
            PlanTask.student_id == student.id,
        )
    )
    if not task:
        raise ValueError("Study task not found.")

    if task.status == "DONE" and payload.action != "REPEAT":
        raise ValueError("A completed task can only be repeated.")

    if payload.action == "START":
        if task.status not in {"PLANNED", "IN_PROGRESS"}:
            raise ValueError("This task cannot be started.")
        task.status = "IN_PROGRESS"
        db.commit()
        return plan, None

    if payload.action == "COMPLETE":
        topic = db.get(Topic, task.topic_id)
        if not topic:
            raise ValueError("Topic not found.")
        actual = payload.actual_minutes or task.minutes
        progress = db.scalar(select(StudentTopicProgress).where(
            StudentTopicProgress.student_id == student.id,
            StudentTopicProgress.topic_id == task.topic_id,
        ))
        if not progress:
            progress = StudentTopicProgress(
                student_id=student.id, topic_id=task.topic_id,
                status="IN_PROGRESS", confidence=3, completed_minutes=0, study_sessions=0,
            )
            db.add(progress)
            db.flush()
        progress.completed_minutes += actual
        progress.study_sessions += 1
        progress.last_studied_at = datetime.now(timezone.utc)
        if payload.confidence is not None:
            progress.confidence = blend_confidence(progress.confidence, payload.confidence)
        progress.status = "COMPLETED" if progress.completed_minutes >= topic.estimated_study_minutes else "IN_PROGRESS"
        task.actual_minutes = actual
        task.confidence = payload.confidence
        task.status = "DONE"
        db.commit()
        return plan, None

    if payload.action == "SKIP":
        task.status = "SKIPPED"
        db.commit()
        if payload.rebuild:
            snapshot = _input_from_snapshot(plan)
            deferred = {task.topic_id}
            pins = {
                row.topic_id: row.planned_date
                for row in db.scalars(select(PlanTask).where(PlanTask.plan_id == plan.id, PlanTask.pinned.is_(True))).all()
                if row.status != "SKIPPED"
            }
            return save_plan(db, student, snapshot, deferred_topic_ids=deferred, pinned_topic_dates=pins), None
        return plan, "SKIPPED_NEEDS_REBUILD"

    if payload.action == "MOVE":
        if payload.target_date is None:
            raise ValueError("Choose a date for this task.")
        task.planned_date = payload.target_date
        task.pinned = True
        task.status = "MOVED"
        db.commit()
        return plan, "PIN_NON_STUDY_DAY"

    if payload.action == "REPEAT":
        target = payload.target_date or task.planned_date
        review = PlanTask(
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
        )
        db.add(review)
        db.commit()
        return plan, None

    if payload.action == "REMOVE":
        if task.status not in {"PLANNED", "IN_PROGRESS", "MOVED"}:
            raise ValueError("Only planned work can be removed.")
        task.status = "REMOVED"
        db.commit()
        return plan, None

    if payload.action == "ADD":
        if payload.target_topic_id is None:
            raise ValueError("Choose a topic to add.")
        topic = db.get(Topic, payload.target_topic_id)
        if not topic or topic.status != "ACTIVE":
            raise ValueError("The selected topic is not active.")
        snapshot = _input_from_snapshot(plan)
        ids = list(dict.fromkeys(snapshot.topic_ids + [topic.id]))
        target = payload.target_date or today_local()
        updated = snapshot.model_copy(update={
            "topic_ids": ids,
            "pinned_topic_dates": {**snapshot.pinned_topic_dates, topic.id: target},
        })
        return save_plan(db, student, updated), None

    raise ValueError("Unsupported plan action.")
