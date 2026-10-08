from datetime import date
from types import SimpleNamespace

from app.core.time import today_local

import pytest

from app.api import havan_planner
from app.api.havan_planner import _to_plan_input, create_current_plan
from app.schemas.havan_planner import HavanPlanCreate, HavanPlanTaskAction
from app.schemas.plan import PlanAction, PlanInput, PlanOut
from app.db.models.plan import PlanTask
from app.services.plan_actions import apply_action
from app.services.plan_builder import _today_carryover_tasks, _warning_fix, _warning_severity


def test_havan_today_maps_to_current_day_and_selected_time():
    today = today_local().weekday()
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


def test_havan_plan_preserves_per_topic_study_estimates():
    payload = HavanPlanCreate(
        mode="week",
        horizon_days=7,
        topic_ids=[101, 102],
        topic_estimates={101: 45, 102: 90},
        study_days=[0],
        hours_per_day={0: 2.0},
    )

    result = _to_plan_input(payload)

    assert result.topic_estimates == {101: 45, 102: 90}


def test_havan_task_action_passes_actual_focus_minutes(monkeypatch):
    plan = SimpleNamespace(id=42)
    captured = {}
    monkeypatch.setattr(havan_planner, "apply_action", lambda db, student, task_id, payload, **kwargs: (captured.update({
        "task_id": task_id,
        "payload": payload,
        "plan_id": kwargs["plan_id"],
    }) or (plan, [])))
    monkeypatch.setattr(havan_planner, "_read_havan", lambda db, student, result: "updated")

    result = havan_planner.action_current_task(
        42,
        7,
        HavanPlanTaskAction(action="COMPLETE", actual_minutes=25),
        SimpleNamespace(id=7),
        SimpleNamespace(scalar=lambda query: plan),
    )

    assert result == "updated"
    assert captured["task_id"] == 7
    assert captured["payload"].actual_minutes == 25
    assert captured["plan_id"] == 42


def test_removing_topic_clears_its_saved_time_estimates():
    plan = SimpleNamespace(
        id=42,
        input_snapshot=PlanInput(
            topic_ids=[101, 102],
            topic_minutes={101: 25, 102: 30},
            topic_estimates={101: 60, 102: 90},
        ).model_dump(mode="json"),
        unplaced=[],
    )
    task = SimpleNamespace(id=7, topic_id=101, course_id=8, minutes=30, status="PLANNED")
    topic = SimpleNamespace(name="Topic 101")

    class FakeDb:
        def __init__(self):
            self.scalar_results = [plan, task]

        def scalar(self, query):
            return self.scalar_results.pop(0)

        def get(self, model, topic_id):
            return topic

        def delete(self, item):
            assert item is task

        def commit(self):
            pass

    result, warnings = apply_action(
        FakeDb(),
        SimpleNamespace(id=9),
        7,
        PlanAction(action="REMOVE"),
        plan_id=42,
    )

    assert result.input_snapshot["topic_ids"] == [102]
    assert result.input_snapshot["topic_minutes"] == {"102": 30}
    assert result.input_snapshot["topic_estimates"] == {"102": 90}
    assert warnings == []


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


def test_havan_build_formats_saved_plan_output_without_reading_snapshot_from_plan_out(monkeypatch):
    payload = HavanPlanCreate(
        mode="week",
        horizon_days=7,
        topic_ids=[101],
        study_days=[0],
        hours_per_day={0: 1.0},
    )
    saved = PlanOut(
        id=42,
        student_id=7,
        mode="week",
        horizon_days=7,
        start_date=date(2026, 10, 8),
        engine_version="test",
        total_minutes=60,
        tasks=[],
        readiness=[],
        warnings=[],
        unplaced=[],
        saved=True,
    )
    captured = {}

    monkeypatch.setattr(havan_planner, "save_plan", lambda *args, **kwargs: saved)

    def fake_read(db, student, out, *, plan_id, input_snapshot):
        captured["plan_id"] = plan_id
        captured["input_snapshot"] = input_snapshot
        assert out is saved
        return "built"

    monkeypatch.setattr(havan_planner, "_read_havan_from_out", fake_read)

    result = create_current_plan(payload, SimpleNamespace(id=7), object())

    assert result == "built"
    assert captured["plan_id"] == 42
    assert captured["input_snapshot"]["topic_ids"] == [101]


def test_rebuild_carryover_only_keeps_topics_still_selected():
    today = date(2026, 10, 8)
    rows = [
        PlanTask(topic_id=101, planned_date=today, status="DONE"),
        PlanTask(topic_id=202, planned_date=today, status="IN_PROGRESS"),
        PlanTask(topic_id=303, planned_date=today, status="SKIPPED"),
    ]

    carried = _today_carryover_tasks(rows, today, {101, 303})

    assert [row.topic_id for row in carried] == [101]


def test_saved_plan_warning_metadata_uses_catalog_helpers():
    assert _warning_severity("DOES_NOT_FIT") == "warn"
    assert _warning_fix("DOES_NOT_FIT")["add_time"] == "Add time"
    assert _warning_severity("UNKNOWN_WARNING") == "info"
    assert _warning_fix("UNKNOWN_WARNING") == {}
