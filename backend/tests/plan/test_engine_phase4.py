from datetime import date, timedelta

from app.services.planner_engine import (
    PlanRequest,
    PlannerExam,
    PlannerTopic,
    StudyCalendar,
    build_plan,
    suggest_extras,
)


def topic(topic_id: int, course_id: int = 1, minutes: int = 30) -> PlannerTopic:
    return PlannerTopic(
        topic_id=topic_id,
        course_id=course_id,
        name=f"Topic {topic_id}",
        difficulty=3,
        estimated_minutes=minutes,
        exam_importance=0.5,
        conceptual_importance=0.5,
        chapter_order=topic_id,
        topic_order=topic_id,
    )


def calendar(minutes: int = 60, days=frozenset({0, 1, 2, 3, 4})) -> StudyCalendar:
    return StudyCalendar(study_weekdays=days, daily_minutes=minutes)


def test_g1_only_selected_topics_are_planned():
    request = PlanRequest(
        today=date(2026, 10, 5),
        topics=(topic(1), topic(2)),
        calendar=calendar(60),
    )
    result = build_plan(request)
    assert {session.topic_id for session in result.sessions} <= {1, 2}


def test_g2_unplaced_never_disappears():
    request = PlanRequest(
        today=date(2026, 10, 5),
        topics=tuple(topic(i, minutes=60) for i in range(1, 5)),
        calendar=calendar(60, frozenset({0})),
        horizon_days=1,
    )
    result = build_plan(request)
    assert len(result.unplaced) >= 3
    assert {item.topic_id for item in result.unplaced}.isdisjoint({session.topic_id for session in result.sessions})


def test_g3_pin_is_kept_on_requested_date():
    friday = date(2026, 10, 9)
    request = PlanRequest(
        today=date(2026, 10, 5),
        topics=(topic(1, minutes=60), topic(2, minutes=60)),
        calendar=StudyCalendar(
            study_weekdays=frozenset({0, 1, 2, 3, 4}),
            daily_minutes=60,
            capacity_overrides={friday: 120},
        ),
        horizon_days=5,
        pinned_topic_dates={1: friday},
    )
    result = build_plan(request)
    pinned = [session for session in result.sessions if session.topic_id == 1]
    assert pinned
    assert all(session.planned_date == friday for session in pinned)


def test_g4_deferred_topic_waits_for_next_study_day():
    request = PlanRequest(
        today=date(2026, 10, 5),
        topics=(topic(1), topic(2)),
        calendar=calendar(30),
        deferred_topic_ids=frozenset({1}),
    )
    result = build_plan(request)
    deferred = [session for session in result.sessions if session.topic_id == 1]
    assert deferred
    assert all(session.planned_date > date(2026, 10, 5) for session in deferred)


def test_g5_totals_equal_task_sum():
    request = PlanRequest(
        today=date(2026, 10, 5),
        topics=tuple(topic(i, minutes=45) for i in range(1, 5)),
        calendar=calendar(60),
    )
    result = build_plan(request)
    assert sum(session.minutes for session in result.sessions) == sum(
        result.minutes_by_date().values()
    )
    assert all(session.minutes % 5 == 0 for session in result.sessions)


def test_exam_readiness_overloaded():
    request = PlanRequest(
        today=date(2026, 10, 5),
        topics=tuple(topic(i, minutes=100) for i in range(1, 4)),
        exams=(PlannerExam(1, date(2026, 10, 8), 4, "MID"),),
        calendar=calendar(100),
        horizon_days=3,
    )
    result = build_plan(request)
    assert result.readiness[0].status == "OVERLOADED"
    assert result.readiness[0].shortfall_minutes == 100


def test_determinism():
    request = PlanRequest(
        today=date(2026, 10, 5),
        topics=(topic(1), topic(2), topic(3)),
        calendar=calendar(60),
    )
    first = build_plan(request)
    second = build_plan(request)
    assert first == second


def test_known_topic_is_not_planned():
    request = PlanRequest(
        today=date(2026, 10, 5),
        topics=(topic(1), topic(2)),
        known_topic_ids=frozenset({1}),
        calendar=calendar(60),
    )
    result = build_plan(request)
    assert 1 not in {session.topic_id for session in result.sessions}
    assert all(item.topic_id != 1 for item in result.unplaced)


def test_suggestions_never_change_plan_scope():
    request = PlanRequest(
        today=date(2026, 10, 5),
        topics=(topic(1),),
        calendar=calendar(60),
    )
    suggestions = suggest_extras(request, (topic(2), topic(3)), k=2)
    assert [item.topic.topic_id for item in suggestions] == [2, 3]
    result = build_plan(request)
    assert {session.topic_id for session in result.sessions} <= {1}
