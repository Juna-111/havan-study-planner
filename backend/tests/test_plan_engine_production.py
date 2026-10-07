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
