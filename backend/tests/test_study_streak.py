from datetime import date, timedelta

from app.api.student import calculate_study_streak


def test_study_streak_counts_consecutive_days_including_today():
    today = date(2026, 10, 8)

    streak, completed_today = calculate_study_streak(
        {today, today - timedelta(days=1), today - timedelta(days=2)},
        today,
    )

    assert streak == 3
    assert completed_today is True


def test_study_streak_keeps_yesterday_streak_until_today_is_completed():
    today = date(2026, 10, 8)

    streak, completed_today = calculate_study_streak(
        {today - timedelta(days=1), today - timedelta(days=2)},
        today,
    )

    assert streak == 2
    assert completed_today is False


def test_study_streak_does_not_bridge_a_missed_day():
    today = date(2026, 10, 8)

    streak, completed_today = calculate_study_streak(
        {today, today - timedelta(days=2)},
        today,
    )

    assert streak == 1
    assert completed_today is True
