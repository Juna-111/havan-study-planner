from datetime import date, timedelta

from app.services.planner_engine import (
    PlannerExam,
    PlannerTopic,
    exam_urgency,
    schedule_tasks,
    score_topic,
)

TODAY = date(2026, 10, 1)


def topic(topic_id: int, *, course_id=1, minutes=60, difficulty=3,
          exam_importance=0.5, status="NOT_STARTED", confidence=3):
    return PlannerTopic(
        topic_id=topic_id, course_id=course_id, name=f"Topic {topic_id}",
        difficulty=difficulty, estimated_minutes=minutes,
        exam_importance=exam_importance, conceptual_importance=0.5,
        progress_status=status, progress_confidence=confidence,
    )


def test_exam_urgency_increases_as_exam_approaches():
    assert exam_urgency(2) > exam_urgency(20)
    assert exam_urgency(2) > exam_urgency(None)


def test_exam_urgency_affects_score():
    urgent = score_topic(
        topic(1),
        PlannerExam(1, TODAY + timedelta(days=2), 5, "MIDTERM"),
        TODAY,
    )
    distant = score_topic(
        topic(1),
        PlannerExam(1, TODAY + timedelta(days=25), 5, "MIDTERM"),
        TODAY,
    )
    assert urgent.score > distant.score


def test_available_time_is_never_exceeded():
    items = [score_topic(topic(i, minutes=120), None, TODAY) for i in (1, 2, 3)]
    dates = [TODAY, TODAY + timedelta(days=1)]
    scheduled = schedule_tasks(items, dates, daily_capacity=60)
    assert sum(minutes for _, _, minutes in scheduled) <= 120
    assert all(
        sum(minutes for _, planned, minutes in scheduled if planned == day) <= 60
        for day in dates
    )


def test_multiple_courses_are_supported():
    items = [
        score_topic(topic(1, course_id=1), None, TODAY),
        score_topic(topic(2, course_id=2), None, TODAY),
    ]
    scheduled = schedule_tasks(items, [TODAY, TODAY + timedelta(days=1)], 60)
    assert {item.topic.course_id for item, _, _ in scheduled} == {1, 2}


def test_different_exam_dates_change_order():
    soon = score_topic(
        topic(1), PlannerExam(1, TODAY + timedelta(days=2), 4, "MIDTERM"), TODAY
    )
    later = score_topic(
        topic(2), PlannerExam(1, TODAY + timedelta(days=20), 4, "MIDTERM"), TODAY
    )
    assert soon.score > later.score


def test_insufficient_time_returns_only_what_fits():
    items = [score_topic(topic(i, minutes=180), None, TODAY) for i in (1, 2)]
    scheduled = schedule_tasks(items, [TODAY], 30)
    assert sum(minutes for _, _, minutes in scheduled) <= 30
    assert len(scheduled) == 1
    assert scheduled[0][2] == 30


def test_short_topic_duration_is_not_inflated():
    item = score_topic(topic(1, minutes=10), None, TODAY)
    scheduled = schedule_tasks([item], [TODAY], 60)
    assert len(scheduled) == 1
    assert scheduled[0][2] == 10


def test_recommendation_reason_explains_major_signals():
    item = score_topic(
        topic(1, difficulty=5, exam_importance=0.8, status="IN_PROGRESS", confidence=2),
        PlannerExam(1, TODAY + timedelta(days=3), 5, "FINAL"),
        TODAY,
    )
    assert "FINAL is in 3 day(s)" in item.reason
    assert "high exam importance" in item.reason
    assert "Expert difficulty (rated by senior students)" in item.reason
    assert "already started it" in item.reason
    assert "low confidence" in item.reason


def test_senior_difficulty_affects_priority():
    easy = score_topic(topic(1, difficulty=1), None, TODAY)
    expert = score_topic(topic(2, difficulty=5), None, TODAY)
    assert expert.score > easy.score
    assert "Expert difficulty" in expert.reason


def test_deferred_topic_waits_until_after_first_study_day():
    first = score_topic(topic(1, minutes=30), None, TODAY)
    second = score_topic(topic(2, minutes=30), None, TODAY)
    scheduled = schedule_tasks(
        [first, second],
        [TODAY, TODAY + timedelta(days=1)],
        30,
        deferred_topic_ids={1},
    )
    assert scheduled[0][0].topic.topic_id == 2
    assert scheduled[-1][0].topic.topic_id == 1
    assert scheduled[-1][1] == TODAY + timedelta(days=1)


def test_pinned_topic_starts_on_requested_date():
    pinned = score_topic(topic(1, minutes=30), None, TODAY)
    other = score_topic(topic(2, minutes=30), None, TODAY)
    target = TODAY + timedelta(days=1)
    scheduled = schedule_tasks(
        [pinned, other],
        [TODAY, target],
        30,
        pinned_topic_dates={1: target},
    )
    pinned_rows = [(day, minutes) for item, day, minutes in scheduled if item.topic.topic_id == 1]
    assert pinned_rows == [(target, 30)]


def test_partial_topic_progress_schedules_only_remaining_minutes():
    partially_studied = topic(1, minutes=30, status="IN_PROGRESS")
    item = score_topic(partially_studied, None, TODAY)
    scheduled = schedule_tasks([item], [TODAY], 60)
    assert scheduled[0][2] == 30