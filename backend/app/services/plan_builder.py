    )

    active = db.scalars(
        select(Plan).where(Plan.student_id == student.id, Plan.status == "ACTIVE")
    ).all()
    today_date = result.today
    carry_rows = [
        row
        for old in active
        for row in db.scalars(
            select(PlanTask).where(
                PlanTask.plan_id == old.id,
                PlanTask.planned_date == today_date,
                PlanTask.status.in_(("DONE", "IN_PROGRESS")),
            )
        ).all()
    ]
    carry_keys = {(row.topic_id, row.planned_date, row.kind) for row in carry_rows}
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