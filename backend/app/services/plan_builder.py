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
from app.services.plan.engine import PlanResult, PlanWarning, allocate_selected_topics



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

WARNING_CATALOG: dict[str, tuple[str, str, dict[str, str]]] = {
    "DOES_NOT_FIT": ("warn", "Some selected topics could not fit before their available deadlines.", {"add_time": "Add time", "add_day": "Add a study day", "remove_topics": "Remove topics"}),
    "EXAM_OVERLOADED": ("danger", "Your selected work needs {shortfall} more minutes before this exam.", {"add_time": "Add time", "choose_topics": "Choose fewer topics"}),
    "PIN_OVER_CAPACITY": ("warn", "This date is over your configured study capacity, but Havan kept your choice.", {"keep": "Keep this date"}),
    "PIN_NON_STUDY_DAY": ("info", "You chose a date that is not normally a study day. Havan kept it for this topic.", {"keep": "Keep this date"}),
    "PIN_AFTER_EXAM": ("danger", "You chose a date after this topic's exam deadline. Havan kept your choice.", {"keep": "Keep this date"}),
    "SKIPPED_NEEDS_REBUILD": ("info", "This task was skipped. Rebuild the remaining plan to reorganize future work.", {"rebuild": "Rebuild the rest"}),
    "MOVE_OVER_CAPACITY": ("warn", "This move puts the task beyond your configured capacity for that date.", {"keep": "Keep this date"}),
    "NO_STUDY_TIME": ("warn", "There is no free study time inside the planning window.", {"add_time": "Add time", "add_day": "Add a study day"}),
    "NOTHING_TO_PLAN": ("info", "There is no unfinished selected work to schedule.", {}),
}


def warning_payload(code: str, *, shortfall: int | None = None) -> dict[str, object]:
    severity, template, fix = WARNING_CATALOG.get(
        code,
        ("info", "Havan could not complete one planning step. Please review your choices.", {}),
    )
    return {
        "code": code,
        "severity": severity,
        "message": template.format(shortfall=shortfall or 0),
        "fix": fix,
    }


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
            "id": saved_tasks[index].id if saved_plan and index < len(saved_tasks) else None,
            "course_id": course.id,
            "course_code": course.code,
            "course_name": course.name,
            "topic_id": topic.id,
            "topic_name": topic.name,
            "chapter_name": chapter_map[topic.chapter_id].name,
            "planned_date": session.planned_date,
            "minutes": session.minutes,
            "priority": session.priority,
            "reason": session.reason,
            "reason_parts": [list(part) for part in session.reason_parts],
            "kind": session.kind,
            "status": saved_tasks[index].status if saved_plan and index < len(saved_tasks) else "PLANNED",
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

    warnings = [
        warning_payload(
            item.code,
            shortfall=next(
                (
                    readiness.shortfall_minutes
                    for readiness in result.readiness
                    if item.code == "EXAM_OVERLOADED" and readiness.status == "OVERLOADED"
                ),
                None,
            ),
        )
        for item in result.warnings
    ]

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
            "topic_id": topic.id, "topic_name": topic.name, "chapter_name": chapter_map[topic.chapter_id].name, "planned_date": row.planned_date,
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
    frozen_topic_ids: set[int] | None = None,
    today: date | None = None,
) -> PlanResult:
    """Build a smart plan without changing the student's topic choices."""
    request = build_request(
        db,
        student,
        plan_input,
        deferred_topic_ids=deferred_topic_ids or set(),
        pinned_topic_dates=pinned_topic_dates,
        frozen_topic_ids=frozen_topic_ids or set(),
        today=today,
    )
    return allocate_selected_topics(request)

def preview_plan(
    db: Session,
    student: StudentProfile,
    plan_input: PlanInput,
    *,
    deferred_topic_ids: set[int] | None = None,
    pinned_topic_dates: dict[int, date] | None = None,
    today: date | None = None,
) -> PlanOut:
    result = build_student_choice_result(
        db, student, plan_input,
        deferred_topic_ids=deferred_topic_ids,
        pinned_topic_dates=pinned_topic_dates,
        today=today,
    )
    return _result_to_out(db, student, plan_input, result)


def _today_carryover_tasks(rows: list[PlanTask], today: date) -> list[PlanTask]:
    return [
        row
        for row in rows
        if row.planned_date == today and row.status in {"DONE", "IN_PROGRESS"}
    ]


def save_plan(
    db: Session,
    student: StudentProfile,
    plan_input: PlanInput,
    *,
    deferred_topic_ids: set[int] | None = None,
    pinned_topic_dates: dict[int, date] | None = None,
    today: date | None = None,
) -> PlanOut:
    result = build_student_choice_result(
        db, student, plan_input,
        deferred_topic_ids=deferred_topic_ids,
        pinned_topic_dates=pinned_topic_dates,
        today=today,
    )

    active = db.scalars(
        select(Plan).where(Plan.student_id == student.id, Plan.status == "ACTIVE")
    ).all()
    today_date = result.today
    carry_rows: list[PlanTask] = []
    for old in active:
        rows = db.scalars(
            select(PlanTask).where(
                PlanTask.plan_id == old.id,
                PlanTask.planned_date == today_date,
                PlanTask.status.in_(("DONE", "IN_PROGRESS")),
            )
        ).all()
        carry_rows.extend(_today_carryover_tasks(rows, today_date))

    # A student may have more than one active plan after an interrupted rebuild.
    # Carry each today's task at most once into the replacement plan.
    carry_by_key = {
        (row.topic_id, row.planned_date, row.kind): row
        for row in carry_rows
    }
    carry_rows = list(carry_by_key.values())
    carry_keys = set(carry_by_key)
    sessions_to_save = [
        session
        for session in result.sessions
        if (session.topic_id, session.planned_date, session.kind) not in carry_keys
    ]

    for old in active:
        old.status = "ARCHIVED"

    plan = Plan(
        student_id=student.id,
        mode=plan_input.mode,
        horizon_days=plan_input.horizon_days,
        start_date=result.today,
        engine_version=result.engine_version,
        total_minutes=sum(item.minutes for item in sessions_to_save) + sum(row.minutes for row in carry_rows),
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

    for row in carry_rows:
        db.add(
            PlanTask(
                plan_id=plan.id,
                student_id=student.id,
                course_id=row.course_id,
                topic_id=row.topic_id,
                planned_date=row.planned_date,
                minutes=row.minutes,
                priority=row.priority,
                reason=row.reason,
                reason_parts=row.reason_parts,
                kind=row.kind,
                status=row.status,
                pinned=row.pinned,
                actual_minutes=row.actual_minutes,
                confidence=row.confidence,
            )
        )

    for session in sessions_to_save:
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
    return read_plan(db, student, plan)
