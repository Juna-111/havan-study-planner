from datetime import date

import pytest

from app.api.havan_planner import _to_plan_input
from app.schemas.havan_planner import HavanPlanCreate


def test_havan_today_maps_to_current_day_and_selected_time():
    today = date.today().weekday()
    payload = HavanPlanCreate(
        mode="today",
        horizon_days=1,
        topic_ids=[101],
        study_days=[today],
        hours_per_day={today: 1.5},
    )

    result = _to_plan_input(payload)

    assert result.mode == "today"
    assert result.horizon_days == 1
    assert result.topic_ids == [101]
    assert result.minutes_by_weekday
    assert result.minutes_by_weekday[list(result.minutes_by_weekday)[0]] == 90


def test_havan_week_preserves_selected_days_and_hours():
    payload = HavanPlanCreate(
        mode="week",
        horizon_days=7,
        topic_ids=[101, 102],
        study_days=[0, 2, 4],
        hours_per_day={0: 1.0, 2: 2.0, 4: 1.5},
    )

    result = _to_plan_input(payload)

    assert result.mode == "week"
    assert result.horizon_days == 7
    assert result.study_days == ["mon", "wed", "fri"]
    assert result.minutes_by_weekday == {"mon": 60, "wed": 120, "fri": 90}


def test_havan_rejects_mode_and_horizon_mismatch():
    payload = HavanPlanCreate(
        mode="week",
        horizon_days=1,
        topic_ids=[101],
        study_days=[0],
        hours_per_day={0: 1.0},
    )

    with pytest.raises(Exception, match="mode and horizon"):
        _to_plan_input(payload)
