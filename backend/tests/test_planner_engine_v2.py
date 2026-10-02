from dataclasses import replace
from datetime import date, datetime, timedelta, timezone

from app.services.planner_engine import (
    DEFAULT_CONFIG,
    ENGINE_VERSION,
    PlanRequest,
    PlannerConfig,
    PlannerExam,
    PlannerTopic,
    StudyCalendar,
    blend_confidence,
    build_plan,
    default_exam_importance,
    local_today,
    parse_weekdays,
    render_reason,
    update_pace_factor,
)

TODAY = date(2026, 10, 5)  # a Monday


def topic(topic_id, *, course_id=1, minutes=60, difficulty=3, exam_importance=0.5,
          status="NOT_STARTED", confidence=3, prerequisites=(), soft=(),
          chapter=0, order=0, last_studied=None):
    return PlannerTopic(
        topic_id=topic_id, course_id=course_id, name=f"Topic {topic_id}",
        difficulty=difficulty, estimated_minutes=minutes,
        exam_importance=exam_importance, conceptual_importance=0.5,
        progress_status=status, progress_confidence=confidence,
        prerequisite_ids=prerequisites, soft_prerequisite_ids=soft,
        chapter_order=chapter, topic_order=order, last_studied_on=last_studied,
    )


def exam(course_id=1, days=5, importance=4, kind="MIDTERM", scope=None):
    return PlannerExam(course_id, TODAY + timedelta(days=days), importance, kind,
                       frozenset(scope) if scope is not None else None)


def plan(topics, exams=(), minutes=120, horizon=7, **kwargs):
    calendar = kwargs.pop("calendar", StudyCalendar(
        study_weekdays=frozenset(range(7)), daily_minutes=minutes))
    return build_plan(PlanRequest(
        today=TODAY, topics=topics, exams=exams, calendar=calendar,
        horizon_days=horizon, **kwargs))


def ids_on(result, day):
    return [s.topic_id for s in result.sessions if s.planned_date == day]


def test_config_weights_must_sum_to_one():
    assert abs(DEFAULT_CONFIG.w_urgency + DEFAULT_CONFIG.w_sequence) < 1
    try:
        PlannerConfig(w_urgency=0.9)
    except ValueError:
        return
    raise AssertionError("invalid weights were accepted")


def test_result_carries_engine_version():
    assert plan([topic(1)]).engine_version == ENGINE_VERSION


def test_daily_capacity_is_never_exceeded():
    result = plan([topic(i, minutes=90) for i in range(1, 6)], minutes=100)
    assert all(total <= 100 for total in result.minutes_by_date().values())


def test_minutes_already_studied_today_reduce_todays_capacity():
    calendar = StudyCalendar(
        study_weekdays=frozenset(range(7)), daily_minutes=120,
        done_minutes={TODAY: 90})
    result = plan([topic(i, minutes=120) for i in (1, 2)], calendar=calendar)
    assert result.minutes_by_date()[TODAY] <= 30


def test_dependent_topic_is_scheduled_the_day_after_its_prerequisite():
    result = plan([topic(1, minutes=40), topic(2, minutes=40, prerequisites=(1,))])
    first = [s for s in result.sessions if s.topic_id == 1][0]
    second = [s for s in result.sessions if s.topic_id == 2][0]
    assert second.planned_date > first.planned_date


def test_blocked_topic_is_reported_with_its_blocker():
    result = plan([topic(1), topic(2, prerequisites=(1,))])
    blocked = {b.topic_id: b for b in result.blocked}
    assert blocked[2].waiting_on == (1,)
    assert blocked[2].scheduled_in_plan is True


def test_known_topic_unlocks_dependent_immediately():
    topics = [topic(1), topic(2, prerequisites=(1,))]
    assert 2 not in ids_on(plan(topics, minutes=120), TODAY)
    result = plan(topics, known_topic_ids=frozenset({1}), minutes=120)
    assert 2 in ids_on(result, TODAY)


def test_close_exam_turns_prerequisite_into_advice():
    result = plan(
        [topic(1, minutes=60), topic(2, minutes=60, prerequisites=(1,))],
        exams=[exam(days=2)], minutes=120)
    session = [s for s in result.sessions if s.topic_id == 2][0]
    assert session.planned_date == TODAY
    assert "prerequisite is unfinished" in session.reason


def test_prerequisite_cycle_is_reported_not_scheduled():
    result = plan([topic(1, prerequisites=(2,)), topic(2, prerequisites=(1,)), topic(3)])
    assert {s.topic_id for s in result.sessions} == {3}
    assert any(w.code == "PREREQUISITE_CYCLE" for w in result.warnings)


def test_earlier_chapters_come_first_when_everything_else_is_equal():
    result = plan([topic(1, chapter=3), topic(2, chapter=1), topic(3, chapter=2)],
                  minutes=60, horizon=3)
    assert [s.topic_id for s in result.sessions] == [2, 3, 1]


def test_plan_is_independent_of_input_order():
    topics = [topic(i, difficulty=1 + i % 5, minutes=30 + 10 * i) for i in range(1, 9)]
    forward = plan(topics)
    backward = plan(list(reversed(topics)))
    assert [(s.topic_id, s.planned_date, s.minutes) for s in forward.sessions] == [
        (s.topic_id, s.planned_date, s.minutes) for s in backward.sessions]


def test_heavy_workload_for_a_far_exam_can_outrank_a_light_one_for_a_nearer_exam():
    heavy = [topic(i, course_id=1, minutes=60) for i in range(1, 41)]   # 2400 minutes
    light = [topic(100, course_id=2, minutes=60)]
    result = plan(heavy + light, exams=[exam(1, days=40), exam(2, days=20)],
                  minutes=60, horizon=1)
    assert result.sessions[0].course_id == 1
    assert "of your available study time" in result.sessions[0].reason


def test_overloaded_exam_reports_shortfall_and_extra_time_needed():
    topics = [topic(i, minutes=120) for i in range(1, 7)]   # 720 minutes
    result = plan(topics, exams=[exam(days=4)], minutes=60)
    ready = result.readiness[0]
    assert ready.status == "OVERLOADED"
    assert ready.required_minutes == 720
    assert ready.available_minutes == 240        # study days 0..3, exam day excluded
    assert ready.shortfall_minutes == 480
    assert ready.extra_minutes_per_study_day == 120
    assert any(w.code == "EXAM_OVERLOADED" for w in result.warnings)


def test_comfortable_exam_is_on_track():
    result = plan([topic(1, minutes=60)], exams=[exam(days=10)], minutes=120)
    assert result.readiness[0].status == "ON_TRACK"
    assert result.readiness[0].shortfall_minutes == 0


def test_earlier_exam_demand_counts_against_a_later_exam():
    topics = [topic(1, course_id=1, minutes=200), topic(2, course_id=2, minutes=100)]
    result = plan(topics, exams=[exam(1, days=3), exam(2, days=5)], minutes=60)
    later = [r for r in result.readiness if r.course_id == 2][0]
    assert later.cumulative_required_minutes == 300


def test_a_day_is_shared_between_courses():
    topics = [topic(1, course_id=1, minutes=120), topic(2, course_id=1, minutes=120),
              topic(3, course_id=2, minutes=120), topic(4, course_id=2, minutes=120)]
    result = plan(topics, minutes=120, horizon=2)
    assert {s.course_id for s in result.sessions if s.planned_date == TODAY} == {1, 2}


def test_no_tiny_fragments_of_long_topics():
    topics = [topic(1, minutes=100), topic(2, minutes=100)]
    result = plan(topics, minutes=110, horizon=2)
    assert all(s.minutes >= 15 for s in result.sessions)


def test_short_topic_is_not_inflated():
    result = plan([topic(1, minutes=10)])
    assert result.sessions[0].minutes == 10


def test_sessions_after_the_exam_do_not_claim_the_exam_is_coming():
    topics = [topic(i, minutes=60) for i in range(1, 6)]
    result = plan(topics, exams=[exam(days=2)], minutes=60, horizon=5)
    late = [s for s in result.sessions if s.planned_date > TODAY + timedelta(days=2)]
    assert late and all("MIDTERM is in" not in s.reason for s in late)


def test_exam_scope_limits_which_topics_feel_urgent():
    topics = [topic(1, minutes=60), topic(2, minutes=60)]
    result = plan(topics, exams=[exam(days=3, scope={1})], minutes=60, horizon=1)
    assert result.sessions[0].topic_id == 1


def test_deferred_topic_is_not_placed_on_the_first_study_day():
    result = plan([topic(1, minutes=30), topic(2, minutes=30)],
                  deferred_topic_ids=frozenset({1}), minutes=30, horizon=2)
    assert ids_on(result, TODAY) == [2]
    assert ids_on(result, TODAY + timedelta(days=1)) == [1]


def test_single_study_day_does_not_drop_a_deferred_topic():
    result = plan([topic(1, minutes=30)], deferred_topic_ids=frozenset({1}),
                  minutes=30, horizon=1)
    assert ids_on(result, TODAY) == [1]


def test_pinned_topic_waits_for_its_date_then_goes_first():
    target = TODAY + timedelta(days=1)
    result = plan([topic(1, minutes=30, difficulty=1), topic(2, minutes=30, difficulty=5)],
                  pinned_topic_dates={1: target}, minutes=30, horizon=2)
    assert ids_on(result, TODAY) == [2]
    assert ids_on(result, target) == [1]
    assert "you chose this date" in result.sessions[-1].reason


def test_completed_topic_gets_a_short_review_before_a_close_exam():
    studied = topic(1, status="COMPLETED", confidence=2, minutes=1,
                    last_studied=TODAY - timedelta(days=10))
    result = plan([studied, topic(2, minutes=60)], exams=[exam(days=6)], minutes=120)
    reviews = [s for s in result.sessions if s.kind == "REVIEW"]
    assert len(reviews) == 1 and reviews[0].minutes == 20
    assert "revision is due" in reviews[0].reason


def test_recently_studied_topic_is_not_reviewed_yet():
    studied = topic(1, status="COMPLETED", minutes=1, last_studied=TODAY - timedelta(days=1))
    result = plan([studied], exams=[exam(days=6)])
    assert not [s for s in result.sessions if s.planned_date < TODAY + timedelta(days=4)]
    assert [s for s in result.sessions if s.planned_date == TODAY + timedelta(days=4)]


def test_reviews_never_take_over_the_day():
    studied = [topic(i, status="COMPLETED", minutes=1, confidence=1,
                     last_studied=TODAY - timedelta(days=20)) for i in range(1, 8)]
    result = plan(studied + [topic(50, minutes=200)], exams=[exam(days=5)],
                  minutes=100, horizon=1)
    review_minutes = sum(s.minutes for s in result.sessions if s.kind == "REVIEW")
    assert review_minutes <= 30


def test_pace_factor_scales_estimated_minutes():
    slow = plan([topic(1, minutes=60)], pace_factor=1.5, minutes=240)
    assert sum(s.minutes for s in slow.sessions) == 90


def test_pace_factor_is_clamped():
    result = plan([topic(1, minutes=60)], pace_factor=9.0, minutes=480)
    assert sum(s.minutes for s in result.sessions) == 120


def test_update_pace_factor_moves_toward_observed_speed():
    assert update_pace_factor(1.0, 60, 90) == 1.15
    assert update_pace_factor(1.0, 0, 90) == 1.0


def test_blend_confidence_stays_in_range():
    assert blend_confidence(3, 5) == 4
    assert blend_confidence(1, 1) == 1
    assert 1 <= blend_confidence(5, 99) <= 5


def test_blackout_date_gets_no_sessions():
    blackout = TODAY + timedelta(days=1)
    calendar = StudyCalendar(study_weekdays=frozenset(range(7)), daily_minutes=60,
                             blackout_dates=frozenset({blackout}))
    result = plan([topic(i, minutes=60) for i in range(1, 5)], calendar=calendar, horizon=3)
    assert blackout not in result.minutes_by_date()


def test_weekend_can_have_more_time_than_weekdays():
    saturday = TODAY + timedelta(days=5)
    calendar = StudyCalendar(study_weekdays=frozenset(range(7)), daily_minutes=60,
                             minutes_by_weekday={5: 180})
    result = plan([topic(i, minutes=90) for i in range(1, 12)], calendar=calendar, horizon=7)
    assert result.minutes_by_date()[saturday] == 180


def test_no_study_time_returns_an_empty_plan_with_a_warning():
    calendar = StudyCalendar(study_weekdays=frozenset())
    result = plan([topic(1)], calendar=calendar)
    assert not result.sessions
    assert any(w.code == "NO_STUDY_TIME" for w in result.warnings)


def test_every_session_explains_itself_with_components():
    result = plan([topic(1, difficulty=5, confidence=1)], exams=[exam(days=4)])
    session = result.sessions[0]
    assert session.reason and "urgency" in session.components
    assert "MIDTERM is in" in session.reason


def test_local_today_uses_ethiopian_time():
    late_utc = datetime(2026, 10, 2, 22, 30, tzinfo=timezone.utc)   # 01:30 next day in Addis
    assert local_today(now=late_utc) == date(2026, 10, 3)


def test_parse_weekdays_accepts_names_and_stored_numbers():
    assert parse_weekdays(["Mon", "wed", "sat"]) == frozenset({0, 2, 5})
    assert parse_weekdays([0, 1]) == frozenset({6, 0})        # 0 = Sunday, 1 = Monday
    assert parse_weekdays([]) == frozenset({0, 1, 2, 3, 4})


def test_default_exam_importance_by_type():
    assert default_exam_importance("Final exam") == 5
    assert default_exam_importance("midterm") == 4
    assert default_exam_importance("quiz 2") == 2
    assert default_exam_importance("presentation") == 3


def test_unknown_language_falls_back_to_english():
    parts = [("exam_in", {"exam_type": "FINAL", "days": 3})]
    assert render_reason(parts, "am") == render_reason(parts, "en")