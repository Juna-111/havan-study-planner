from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.planner import _validate_move_target


def make_plan(horizon_days=7):
    return SimpleNamespace(
        created_at=datetime.now(timezone.utc),
        horizon_days=horizon_days,
    )


def make_task(minutes=60):
    return SimpleNamespace(estimated_minutes=minutes)


def test_move_rejects_when_target_day_exceeds_daily_capacity():
    with pytest.raises(
        HTTPException,
        match="target date does not have enough available study time",
    ):
        _validate_move_target(
            make_plan(),
            make_task(minutes=60),
            date.today(),
            daily_capacity=120,
            used_minutes=90,
        )


def test_move_rejects_task_longer_than_daily_capacity():
    with pytest.raises(
        HTTPException,
        match="longer than the student's available daily study time",
    ):
        _validate_move_target(
            make_plan(),
            make_task(minutes=121),
            date.today(),
            daily_capacity=120,
            used_minutes=0,
        )


def test_move_rejects_target_outside_current_plan_horizon():
    plan = make_plan(horizon_days=3)
    target = plan.created_at.date() + timedelta(days=3)

    with pytest.raises(
        HTTPException,
        match="within the current study plan horizon",
    ):
        _validate_move_target(
            plan,
            make_task(minutes=60),
            target,
            daily_capacity=120,
            used_minutes=0,
        )


def test_move_allows_target_within_horizon_and_capacity():
    plan = make_plan(horizon_days=3)
    target = plan.created_at.date() + timedelta(days=2)

    _validate_move_target(
        plan,
        make_task(minutes=60),
        target,
        daily_capacity=120,
        used_minutes=60,
    )
