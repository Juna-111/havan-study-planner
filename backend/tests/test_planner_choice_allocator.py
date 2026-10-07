from datetime import date, timedelta

import pytest

from app.services.plan.engine import (
    PlanRequest,
    PlannerExam,
    PlannerTopic,
    StudyCalendar,
    allocate_selected_topics,
    blend_confidence,
    update_pace_factor,
)

TODAY = date(2026, 10, 5)


def topic(topic_id, *, course_id=1, minutes=60, difficulty=3, status="NOT_STARTED", confidence=3):
    return PlannerTopic(
        topic_id=topic_id,
        course_id=course_id,
        name=f"Topic {topic_id}",
        difficulty=difficulty,
        estimated_minutes=minutes,
        exam_importance=0.5,
        conceptual_importance=0.5,
        progress_status=status,
        progress_confidence=confidence,
    )


def make_plan(topics, *, minutes=60, horizon=3, exams=(), **kwargs):
    return allocate_selected_topics(
        PlanRequest(
            today=TODAY,
            topics=tuple(topics),
            exams=tuple(exams),
            calendar=StudyCalendar(
                study_weekdays=frozenset(range(7)),
                daily_minutes=minutes,
                **kwargs.pop("calendar", {}),
            ),
            horizon_days=horizon,
            **kwargs,
        )
    )


def test_allocator_never_invents_topics():
    result = make_plan([topic(1), topic(2)])
    assert {s.topic_id for s in result.sessions} <= {1, 2}
    assert {u.topic_id for u in result.unplaced} <= {1, 2}


def test_allocator_respects_daily_capacity():
    result = make_plan([topic(1, minutes=180)], minutes=60, horizon=1)
    assert result.minutes_by_date()[TODAY] <= 60
    assert result.unplaced[0].remaining_minutes > 0


def test_allocator_spreads_selected_courses():
    result = make_plan(
        [topic(1, course_id=1, minutes=60), topic(2, course_id=2, minutes=60)],
        minutes=60,
        horizon=1,
    )
    assert {s.course_id for s in result.sessions} == {1, 2}


def test_allocator_uses_exam_only_as_constraint():
    result = make_plan(
        [topic(1, course_id=1), topic(2, course_id=2)],
        exams=(PlannerExam(1, TODAY + timedelta(days=1), 5, "MIDTERM"),),
        minutes=60,
        horizon=1,
    )
    assert {s.topic_id for s in result.sessions} <= {1, 2}
    assert result.readiness[0].required_minutes == 60


def test_allocator_honours_pinned_date():
    target = TODAY + timedelta(days=1)
    result = make_plan(
        [topic(1), topic(2)],
        minutes=60,
        horizon=2,
        pinned_topic_dates={1: target},
    )
    pinned = [s for s in result.sessions if s.topic_id == 1]
    assert pinned and pinned[0].planned_date == target


def test_allocator_honours_deferred_topic_when_capacity_allows():
    result = make_plan(
        [topic(1, minutes=30), topic(2, minutes=30)],
        minutes=30,
        horizon=2,
        deferred_topic_ids=frozenset({1}),
    )
    assert [s.topic_id for s in result.sessions if s.planned_date == TODAY] == [2]


def test_allocator_rejects_invalid_topic_session_minutes():
    with pytest.raises(ValueError, match="5-120"):
        make_plan([topic(1)], minutes=60, horizon=1, topic_minutes={1: 121})


def test_allocator_scales_with_observed_pace():
    result = make_plan([topic(1)], minutes=180, pace_factor=1.5)
    assert sum(s.minutes for s in result.sessions) == 90


def test_confidence_and_pace_helpers_stay_bounded():
    assert update_pace_factor(1.0, 60, 90) == 1.15
    assert 1 <= blend_confidence(3, 5) <= 5


def test_no_study_time_is_reported():
    result = make_plan(
        [topic(1)],
        minutes=0,
        horizon=1,
    )
    assert not result.sessions
    assert any(w.code == "NO_STUDY_TIME" for w in result.warnings)


def test_exam_deadline_calculation_does_not_break_allocation():
    result = make_plan(
        [topic(1, minutes=60)],
        minutes=60,
        horizon=3,
        exams=(PlannerExam(1, TODAY + timedelta(days=2), 5, "MIDTERM"),),
    )
    assert result.readiness[0].available_minutes == 120
    assert result.readiness[0].required_minutes == 60


def test_exam_day_can_be_used_when_configured():
    from app.services.plan.engine import PlannerConfig

    result = allocate_selected_topics(
        PlanRequest(
            today=TODAY,
            topics=(topic(1, minutes=60),),
            exams=(PlannerExam(1, TODAY, 5, "MIDTERM"),),
            calendar=StudyCalendar(study_weekdays=frozenset(range(7)), daily_minutes=60),
            horizon_days=1,
        ),
        config=PlannerConfig(study_on_exam_day=True),
    )
    assert result.readiness[0].available_minutes == 60
