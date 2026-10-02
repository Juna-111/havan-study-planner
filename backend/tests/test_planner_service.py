from types import SimpleNamespace

import pytest

from app.services import planner as planner_service
from app.db.models.student import StudentCourse, StudentProfile


class ScalarResult:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return list(self.rows)


class PlannerGuardDB:
    def __init__(self, selected):
        self.student = SimpleNamespace(id=1)
        self.selected = selected
        self.scalars_calls = 0

    def get(self, model, student_id):
        assert model is StudentProfile
        assert student_id == self.student.id
        return self.student

    def scalars(self, query):
        self.scalars_calls += 1
        if self.scalars_calls == 1:
            return ScalarResult(self.selected)
        raise AssertionError(
            "Planner attempted to load curriculum data after all selected courses "
            "were unresolved."
        )


def test_generate_plan_rejects_selected_courses_that_are_no_longer_resolved(monkeypatch):
    selected = [
        SimpleNamespace(student_id=1, course_id=101, status="ACTIVE"),
        SimpleNamespace(student_id=1, course_id=202, status="ACTIVE"),
    ]
    db = PlannerGuardDB(selected)

    monkeypatch.setattr(
        planner_service,
        "resolved_course_ids",
        lambda _db, _student_id: set(),
    )

    with pytest.raises(
        ValueError,
        match="selected courses are no longer available in the active university curriculum",
    ):
        planner_service.generate_plan(db, student_id=1)

    assert db.scalars_calls == 1
