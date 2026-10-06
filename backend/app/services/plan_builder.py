from __future__ import annotations

from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.orm import Session
from dataclasses import replace

from app.core.time import to_index
from app.db.models.curriculum import Chapter, Course, Topic
from app.db.models.plan import Plan, PlanTask
from app.db.models.student import StudentProfile
from app.schemas.plan import PlanInput, PlanOut
from app.services.plan_adapter import build_request
from app.services.plan.engine import PlanResult, PlanWarning, PlannedSession, UnplacedTopic



def _add_pin_warnings(result: PlanResult, plan_input: PlanInput) -> PlanResult:
    default_minutes = max(5, round(plan_input.hours_per_day * 60 / 5) * 5)
    selected_days = {to_index(day) for day in plan_input.study_days}
    extra = list(result.warnings)
    pinned_per_date: dict[date, int] = {}
    for topic_id, pinned_date in plan_input.pinned_topic_dates.items():
        pinned_per_date[pinned_date] = pinned_per_date.get(pinned_date, 0) + 1
        if pinned_date.weekday() not in selected_days:
            extra.append(PlanWarning(
                "PIN_NON_STUDY_DAY", f"{pinned_date.isoformat()} is not one of your study days. We kept the topic there."
            ))
    for pinned_date in pinned_per_date:
        pinned_minutes = sum(
            session.minutes for session in result.sessions
            if session.planned_date == pinned_date and session.topic_id in plan_input.pinned_topic_dates
        )
        if pinned_minutes > default_minutes:
            extra.append(PlanWarning(
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

def build_student_choice_result(
    db: Session,
    student: StudentProfile,
    plan_input: PlanInput,
    *,
    deferred_topic_ids: set[int] | None = None,
    pinned_topic_dates: dict[int, date] | None = None,
) -> PlanResult:
    """Phase F allocator: only selected topics receive study time."""
    request = build_request(
        db,
        student,
        plan_input,
        deferred_topic_ids=deferred_topic_ids or set(),
        pinned_topic_dates=pinned_topic_dates,
    )
    topics = [
        topic for topic in request.topics
        if topic.topic_id not in request.known_topic_ids
        and topic.progress_status != "COMPLETED"
    ]
    if not topics:
        raise ValueError("Select at least one unfinished topic.")

    study_days = [
        request.today + timedelta(days=offset)
        for offset in range(max(1, request.horizon_days))
        if request.calendar.capacity(request.today + timedelta(days=offset)) > 0
    ]
    if not study_days:
        return PlanResult(
            engine_version="3.0.0-choice",
            today=request.today,
            sessions=(),
            readiness=(),
            warnings=(PlanWarning("NO_STUDY_TIME", "There is no free study time inside the planning window."),),
            unplaced=tuple(
                UnplacedTopic(topic.topic_id, topic.name, topic.course_id, max(5, topic.estimated_minutes), "no_capacity")
                for topic in topics
            ),
        )

    capacities = {day: request.calendar.capacity(day) for day in study_days}
    remaining = {topic.topic_id: max(5, topic.estimated_minutes) for topic in topics}
    sessions: list[dict] = []
    pinned = dict(request.pinned_topic_dates)

    def place(topic, day):
        available = capacities.get(day, 0)
        chunk = (min(remaining[topic.topic_id], available, 60) // 5) * 5
        if chunk < 5:
            return False
        parts = (("student_selected", {}), ("allocated", {}))
        if topic.topic_id in pinned:
            parts = parts + (("pinned", {}),)
        sessions.append({"topic": topic, "day": day, "minutes": chunk, "parts": parts})
        remaining[topic.topic_id] -= chunk
        capacities[day] -= chunk
        return True

    for topic in topics:
        target = pinned.get(topic.topic_id)
        if target is not None and target not in capacities:
            capacities[target] = request.calendar.capacity(target)
        if target is not None and remaining[topic.topic_id] > 0:
            place(topic, target)

    deferred = deferred_topic_ids or set()
    for topic in topics:
        if remaining[topic.topic_id] <= 0:
            continue
        days = study_days[1:] if topic.topic_id in deferred and len(study_days) > 1 else study_days
        for day in days:
            while remaining[topic.topic_id] > 0 and capacities.get(day, 0) > 0:
                if not place(topic, day):
                    break
            if remaining[topic.topic_id] <= 0:
                break

    built = tuple(
        PlannedSession(
            topic_id=item["topic"].topic_id,
            course_id=item["topic"].course_id,
            planned_date=item["day"],
            minutes=item["minutes"],
            priority=float(index + 1),
            reason="You selected this topic; Havan allocated your available study time.",
            kind="STUDY",
            components={"selection_order": float(index + 1)},
            reason_parts=item["parts"],
        )
        for index, item in enumerate(sessions)
    )
    unplaced = tuple(
        UnplacedTopic(topic.topic_id, topic.name, topic.course_id, remaining[topic.topic_id], "no_capacity")
        for topic in topics
        if remaining[topic.topic_id] > 0
    )
    warnings = (
        (PlanWarning("DOES_NOT_FIT", "Some selected topics need more time than the available study capacity."),)
        if unplaced else ()
    )
    return PlanResult("3.0.0-choice", request.today, built, (), warnings, unplaced)

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
    result = build_student_choice_result(db, student, plan_input, deferred_topic_ids=deferred_topic_ids, pinned_topic_dates=pinned_topic_dates)
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
    result = build_student_choice_result(db, student, plan_input, deferred_topic_ids=deferred_topic_ids, pinned_topic_dates=pinned_topic_dates)

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
