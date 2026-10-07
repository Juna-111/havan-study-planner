from datetime import date, timedelta

from app.services.plan.engine import (
    DEFAULT_CONFIG,
    PlanRequest,
    PlannerConfig,
    PlannerExam,
    PlannerTopic,
    StudyCalendar,
    allocate_selected_topics,
)

TODAY = date(2026, 10, 5)


def topic(topic_id=1, *, course_id=1, minutes=60):
    return PlannerTopic(
        topic_id=topic_id,
        course_id=course_id,
        name=f"Topic {topic_id}",
        difficulty=3,
        estimated_minutes=minutes,
        exam_importance=0.5,
        conceptual_importance=0.5,
    )


def calendar(minutes=120):
    return StudyCalendar(
        study_weekdays=frozenset(range(7)),
        daily_minutes=minutes,
    )


def test_exam_deadline_never_allocates_on_exam_day_by_default():
    exam = PlannerExam(1, TODAY + timedelta(days=3), 5, "MIDTERM")
    result = allocate_selected_topics(
        PlanRequest(
            today=TODAY,
            topics=(topic(minutes=60),),
            exams=(exam,),
            calendar=calendar(120),
            horizon_days=7,
        )
    )
    assert result.sessions
    assert all(session.planned_date < exam.exam_date for session in result.sessions)


def test_final_exam_deadline_never_allocates_on_exam_day_by_default():
    exam = PlannerExam(1, TODAY + timedelta(days=5), 5, "FINAL")
    result = allocate_selected_topics(
        PlanRequest(
            today=TODAY,
            topics=(topic(minutes=30),),
            exams=(exam,),
            calendar=calendar(120),
            horizon_days=7,
        )
    )
    assert result.sessions
    assert all(session.planned_date < exam.exam_date for session in result.sessions)


def test_exam_today_without_exam_day_study_is_unplaced_and_unavailable():
    exam = PlannerExam(1, TODAY, 5, "FINAL")
    result = allocate_selected_topics(
        PlanRequest(
            today=TODAY,
            topics=(topic(minutes=60),),
            exams=(exam,),
            calendar=calendar(120),
            horizon_days=3,
        )
    )
    assert not result.sessions
    assert result.unplaced[0].reason_code == "exam_today_or_passed"
    assert result.readiness[0].available_minutes == 0
    assert result.readiness[0].status == "OVERLOADED"


def test_exam_day_can_be_used_when_enabled():
    exam = PlannerExam(1, TODAY, 5, "FINAL")
    result = allocate_selected_topics(
        PlanRequest(
            today=TODAY,
            topics=(topic(minutes=60),),
            exams=(exam,),
            calendar=calendar(120),
            horizon_days=1,
        ),
        config=PlannerConfig(study_on_exam_day=True),
    )
    assert [session.planned_date for session in result.sessions] == [TODAY]


def test_allocator_fills_chronologically_and_protects_earliest_deadline():
    urgent = topic(1, minutes=120)
    later = topic(2, minutes=120)
    result = allocate_selected_topics(
        PlanRequest(
            today=TODAY,
            topics=(later, urgent),
            exams=(
                PlannerExam(1, TODAY + timedelta(days=2), 5, "MIDTERM"),
            ),
            calendar=calendar(120),
            horizon_days=5,
        )
    )
    first_day_topics = [
        session.topic_id for session in result.sessions if session.planned_date == TODAY
    ]
    assert first_day_topics
    assert first_day_topics[0] == 1
    assert all(
        session.planned_date < TODAY + timedelta(days=2)
        for session in result.sessions
        if session.topic_id == 1
    )


def test_allocator_is_deterministic_across_repeated_runs():
    request = PlanRequest(
        today=TODAY,
        topics=tuple(topic(i, course_id=(i % 3) + 1, minutes=95) for i in range(1, 9)),
        exams=(
            PlannerExam(1, TODAY + timedelta(days=4), 5, "FINAL"),
            PlannerExam(2, TODAY + timedelta(days=7), 4, "MIDTERM"),
        ),
        calendar=calendar(180),
        horizon_days=10,
    )
    outputs = [allocate_selected_topics(request) for _ in range(20)]
    assert all(output == outputs[0] for output in outputs[1:])


def test_small_remainders_are_merged_instead_of_stranded():
    result = allocate_selected_topics(
        PlanRequest(
            today=TODAY,
            topics=(topic(1, minutes=70), topic(2, minutes=70)),
            calendar=calendar(600),
            horizon_days=5,
        )
    )
    assert result.unplaced == ()
    assert not any(w.code == "DOES_NOT_FIT" for w in result.warnings)
    assert sum(session.minutes for session in result.sessions) == 140
    assert all(session.minutes >= DEFAULT_CONFIG.min_session_minutes for session in result.sessions)


def test_pinned_non_study_date_is_extra_date_only():
    saturday = TODAY + timedelta(days=5)
    sunday = saturday + timedelta(days=1)
    cal = StudyCalendar(
        study_weekdays=frozenset({0, 1, 2, 3, 4}),
        daily_minutes=120,
        extra_study_dates=frozenset({saturday}),
    )
    assert cal.capacity(saturday) == 120
    assert cal.capacity(sunday) == 0
    result = allocate_selected_topics(
        PlanRequest(
            today=TODAY,
            topics=(topic(1, minutes=60),),
            calendar=cal,
            horizon_days=7,
            pinned_topic_dates={1: saturday},
        )
    )
    assert result.sessions[0].planned_date == saturday
    assert result.sessions[0].minutes <= 120


def test_large_preview_stays_under_regression_ceiling():
    import time

    request = PlanRequest(
        today=TODAY,
        topics=tuple(topic(i, course_id=(i % 8) + 1, minutes=90) for i in range(1, 101)),
        exams=tuple(
            PlannerExam(course_id, TODAY + timedelta(days=5 + course_id), 5, "FINAL")
            for course_id in range(1, 9)
        ),
        calendar=calendar(480),
        horizon_days=31,
    )
    started = time.perf_counter()
    allocate_selected_topics(request)
    elapsed = time.perf_counter() - started
    assert elapsed < 0.5


def test_empty_after_known_or_frozen_topics_never_raises():
    request = PlanRequest(
        today=TODAY,
        topics=(topic(1, minutes=60),),
        calendar=calendar(120),
        horizon_days=3,
        known_topic_ids=frozenset({1}),
    )
    result = allocate_selected_topics(request)
    assert result.sessions == ()
    assert any(w.code == "NOTHING_TO_PLAN" for w in result.warnings)


def test_allocator_never_repeats_a_topic_on_the_same_day():
    result = allocate_selected_topics(
        PlanRequest(
            today=TODAY,
            topics=(topic(1, minutes=90),),
            calendar=calendar(120),
            horizon_days=3,
        )
    )
    keys = [
        (session.topic_id, session.planned_date)
        for session in result.sessions
        if session.kind == "STUDY"
    ]
    assert len(keys) == len(set(keys))
