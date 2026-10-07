from datetime import date

from app.db.models.curriculum import Topic
from app.api import havan_planner


def make_topic(topic_id: int, minutes: int) -> Topic:
    return Topic(
        id=topic_id,
        chapter_id=1,
        name=f"Topic {topic_id}",
        estimated_study_minutes=minutes,
        status="ACTIVE",
    )


def test_havan_allocation_uses_selected_topic_estimates_and_exact_capacity():
    topics = [make_topic(1, 30), make_topic(2, 60), make_topic(3, 90)]
    days = [date(2026, 10, 7)]
    tasks = havan_planner._allocate(topics, days, {2: 3.0})

    assert sum(minutes for _, _, minutes in tasks) == 180
    totals = {topic.id: 0 for topic in topics}
    for topic, _, minutes in tasks:
        totals[topic.id] += minutes
    assert totals == {1: 30, 2: 60, 3: 90}


def test_havan_allocation_spreads_large_workload_across_days():
    topics = [make_topic(1, 60), make_topic(2, 60)]
    days = [date(2026, 10, 7), date(2026, 10, 8)]
    tasks = havan_planner._allocate(topics, days, {2: 1.0, 3: 1.0})

    assert sum(minutes for _, _, minutes in tasks) == 120
    assert {task_day for _, task_day, _ in tasks} == set(days)


def test_havan_allocation_does_not_change_topic_scope_from_progress_or_exams():
    topics = [make_topic(1, 20), make_topic(2, 80)]
    tasks = havan_planner._allocate(topics, [date(2026, 10, 7)], {2: 1.0})

    assert {topic.id for topic, _, _ in tasks} == {1, 2}
    assert sum(minutes for _, _, minutes in tasks) == 60
