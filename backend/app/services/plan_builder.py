from __future__ import annotations

from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.orm import Session
from dataclasses import replace

from app.db.models.curriculum import Chapter, Course, Topic
from app.db.models.plan import Plan, PlanTask
from app.db.models.student import StudentProfile
from app.schemas.plan import PlanInput, PlanOut
from app.services.plan_adapter import build_request
from app.services.plan.engine import PlanResult, build_plan



def _add_pin_warnings(result: PlanResult, plan_input: PlanInput) -> PlanResult:
    default_minutes = max(5, round(plan_input.hours_per_day * 60 / 5) * 5)
    selected_days = {to_index(day) for day in plan_input.study_days}
    extra = list(result.warnings)
    pinned_per_date: dict[date, int] = {}
    for topic_id, pinned_date in plan_input.pinned_topic_dates.items():
        pinned_per_date[pinned_date] = pinned_per_date.get(pinned_date, 0) + 1
        if pinned_date.weekday() not in selected_days:
            extra.append(__import__("app.services.planner_engine", fromlist=["PlanWarning"]).PlanWarning(
                "PIN_NON_STUDY_DAY", f"{pinned_date.isoformat()} is not one of your study days. We kept the topic there."
            ))
    for pinned_date in pinned_per_date:
        pinned_minutes = sum(
            session.minutes for session in result.sessions
            if session.planned_date == pinned_date and session.topic_id in plan_input.pinned_topic_dates
        )
        if pinned_minutes > default_minutes:
            extra.append(__import__("app.services.planner_engine", fromlist=["PlanWarning"]).PlanWarning(
                "PIN_OVER_CAPACITY", f"{pinned_date.isoformat()} is full. We kept the pinned topic there as you chose."
            ))

    return replace(result, warnings=tuple(extra))

def _warning_severity(code: str) -> str:
    if code in {"EXAM_OVERLOADED", "DOES_NOT_FIT"}:
        return "danger" if code == "EXAM_OVERLOADED" else "warn"
    return "info"


def _warning_fix(code: str) -> dict[str, str]:
    return {
        "DOES_NOT_FIT": {"add_time": "Add time", "add_day": "Add a study day", "remove_topics": "Remove topics"},
        "EXAM_OVERLOADED": {"add_time": "Add time", "choose_topics": "Choose fewer topics"},
        "PIN_OVER_CAPACITY": {"keep": "Keep this date"},
        "PIN_NON_STUDY_DAY": {"keep": "Keep this date"},
        "SKIPPED_NEEDS_REBUILD": {"rebuild": "Rebuild the rest"},
    }.get(code, {})


def _result_to_out(
    db: Session,
    student: StudentProfile,
    plan_input: PlanInput,
    result: PlanResult,
    saved_plan: Plan | None = None,
) -> PlanOut:
    topic_ids = {session.topic_id for session in result.sessions} | {item.topic_id for item in result.unplaced}
    topics = list(db.scalars(select(Topic).where(Topic.id.in_(topic_ids))).all()) if topic_ids else []
    topic_map = {topic.id: topic for topic in topics}
    chapter_ids = {topic.chapter_id for topic in topics}
    chapters = list(db.scalars(select(Chapter).where(
        Chapter.id.in_(chapter_ids)
    )).all()) if chapter_ids else []
    chapter_map = {chapter.id: chapter for chapter in chapters}
    course_ids = {chapter.course_id for chapter in chapters}
    courses = list(db.scalars(select(Course).where(Course.id.in_(course_ids))).all()) if course_ids else []
    course_map = {course.id: course for course in courses}
    saved_tasks = list(db.scalars(
        select(PlanTask).where(PlanTask.plan_id == saved_plan.id).order_by(PlanTask.id)
    ).all()) if saved_plan else []

    tasks = []
    for index, session in enumerate(result.sessions):
        topic = topic_map[session.topic_id]
        course_id = chapter_map[topic.chapter_id].course_id
        course = course_map[course_id]
        tasks.append({
            "id": saved_tasks[index].id if index < len(saved_tasks) else 0,
            "course_id": course.id,
            "course_code": course.code,
            "course_name": course.name,
            "topic_id": topic.id,
            "topic_name": topic.name,
            "planned_date": session.planned_date,
            "minutes": session.minutes,
            "priority": session.priority,
            "reason": session.reason,
            "reason_parts": [list(part) for part in session.reason_parts],
            "kind": session.kind,
            "status": saved_tasks[index].status if index < len(saved_tasks) else "PLANNED",
            "pinned": topic.id in plan_input.pinned_topic_dates,
        })

    readiness = []
    for item in result.readiness:
        course = course_map.get(item.course_id)
        readiness.append({
            "course_id": item.course_id,
            "course_name": course.name if course else f"Course {item.course_id}",
            "exam_type": item.exam_type,
            "exam_date": item.exam_date,
            "days_left": item.days_left,
            "status": item.status,
            "required_minutes": item.required_minutes,
            "available_minutes": item.available_minutes,
            "shortfall_minutes": item.shortfall_minutes,
            "extra_minutes_per_study_day": item.extra_minutes_per_study_day,
        })

    warnings = [{
        "code": item.code,
        "severity": _warning_severity(item.code),
        "message": item.message,
        "fix": _warning_fix(item.code),
    } for item in result.warnings]

    unplaced = []
    for item in result.unplaced:
        topic = topic_map[item.topic_id]
        course_id = chapter_map[topic.chapter_id].course_id
        course = course_map[course_id]
        unplaced.append({
            "topic_id": item.topic_id,
            "topic_name": item.topic_name,
            "course_id": course_id,
            "course_name": course.name,
            "minutes": item.remaining_minutes,
            "reason_code": item.reason_code,
        })

    return PlanOut(
        id=saved_plan.id if saved_plan else None,
        student_id=student.id,
        mode=plan_input.mode,
        horizon_days=plan_input.horizon_days,
        start_date=result.today,
        engine_version=result.engine_version,
        total_minutes=sum(item.minutes for item in result.sessions),
        tasks=tasks,
        readiness=readiness,
        warnings=warnings,
        unplaced=unplaced,
        saved=saved_plan is not None,
        created_at=saved_plan.created_at if saved_plan else None,
    )


def read_plan(db: Session, student: StudentProfile, plan: Plan) -> PlanOut:
    rows = list(db.scalars(select(PlanTask).where(PlanTask.plan_id == plan.id).order_by(PlanTask.planned_date, PlanTask.id)).all())
    topic_ids = {row.topic_id for row in rows} | {item["topic_id"] for item in plan.unplaced}
    topics = list(db.scalars(select(Topic).where(Topic.id.in_(topic_ids))).all()) if topic_ids else []
    topic_map = {topic.id: topic for topic in topics}
    chapters = list(db.scalars(select(Chapter).where(Chapter.id.in_({topic.chapter_id for topic in topics}))).all()) if topics else []
    chapter_map = {chapter.id: chapter for chapter in chapters}
    courses = list(db.scalars(select(Course).where(Course.id.in_({chapter.course_id for chapter in chapters}))).all()) if chapters else []
    course_map = {course.id: course for course in courses}

    tasks = []
    for row in rows:
        topic = topic_map[row.topic_id]
        course = course_map[chapter_map[topic.chapter_id].course_id]
        tasks.append({
            "id": row.id, "course_id": course.id, "course_code": course.code, "course_name": course.name,
            "topic_id": topic.id, "topic_name": topic.name, "planned_date": row.planned_date,
            "minutes": row.minutes, "priority": row.priority, "reason": row.reason,
            "reason_parts": row.reason_parts, "kind": row.kind, "status": row.status, "pinned": row.pinned,
        })

    readiness = []
    for item in plan.readiness:
        course = course_map.get(item["course_id"])
        readiness.append({**item, "course_name": course.name if course else f"Course {item['course_id']}"})

    warnings = [
        {"code": item["code"], "severity": _warning_severity(item["code"]), "message": item["message"], "fix": _warning_fix(item["code"])}
        for item in plan.warnings
    ]
    unplaced = []
    for item in plan.unplaced:
        course = course_map.get(item["course_id"])
        unplaced.append({**item, "course_name": course.name if course else f"Course {item['course_id']}"})

    return PlanOut(
        id=plan.id, student_id=student.id, mode=plan.mode, horizon_days=plan.horizon_days,
        start_date=plan.start_date, engine_version=plan.engine_version, total_minutes=sum(row.minutes for row in rows),
        tasks=tasks, readiness=readiness, warnings=warnings, unplaced=unplaced,
        saved=True, created_at=plan.created_at,
    )

def preview_plan(
    db: Session,
    student: StudentProfile,
    plan_input: PlanInput,
    *,
    deferred_topic_ids: set[int] | None = None,
    pinned_topic_dates: dict[int, date] | None = None,
) -> PlanOut:
    request = build_request(
        db, student, plan_input, deferred_topic_ids=deferred_topic_ids or set(),
        pinned_topic_dates=pinned_topic_dates,
    )
    result = _add_pin_warnings(build_plan(request), plan_input)
    return _result_to_out(db, student, plan_input, result)


def save_plan(
    db: Session,
    student: StudentProfile,
    plan_input: PlanInput,
    *,
    deferred_topic_ids: set[int] | None = None,
    pinned_topic_dates: dict[int, date] | None = None,
) -> PlanOut:
    request = build_request(
        db, student, plan_input, deferred_topic_ids=deferred_topic_ids or set(),
        pinned_topic_dates=pinned_topic_dates,
    )
    result = _add_pin_warnings(build_plan(request), plan_input)

    active = db.scalars(
        select(Plan).where(Plan.student_id == student.id, Plan.status == "ACTIVE")
    ).all()
    for old in active:
        old.status = "ARCHIVED"

    plan = Plan(
        student_id=student.id,
        mode=plan_input.mode,
        horizon_days=plan_input.horizon_days,
        start_date=result.today,
        engine_version=result.engine_version,
        total_minutes=sum(item.minutes for item in result.sessions),
        readiness=[
            {"course_id": item.course_id, "exam_type": item.exam_type, "exam_date": item.exam_date.isoformat(),
             "days_left": item.days_left, "status": item.status, "required_minutes": item.required_minutes,
             "available_minutes": item.available_minutes, "shortfall_minutes": item.shortfall_minutes,
             "extra_minutes_per_study_day": item.extra_minutes_per_study_day}
            for item in result.readiness
        ],
        warnings=[{"code": item.code, "message": item.message} for item in result.warnings],
        unplaced=[{"topic_id": item.topic_id, "topic_name": item.topic_name, "course_id": item.course_id,
                   "minutes": item.remaining_minutes, "reason_code": item.reason_code}
                  for item in result.unplaced],
        input_snapshot=plan_input.model_dump(mode="json"),
    )
    db.add(plan)
    db.flush()

    for session in result.sessions:
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
            pinned=session.topic_id in plan_input.pinned_topic_dates,
        ))
    db.commit()
    db.refresh(plan)
    return _result_to_out(db, student, plan_input, result, plan)
