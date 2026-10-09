from types import SimpleNamespace

import pytest

from app.api import student as student_api


class FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class FakeDB:
    def __init__(self, courses):
        self.courses = courses

    def scalars(self, query):
        return FakeResult(self.courses)


def test_resolved_student_courses_filters_stale_selections(monkeypatch) -> None:
    rows = [
        SimpleNamespace(course_id=101, status="ACTIVE"),
        SimpleNamespace(course_id=202, status="ACTIVE"),
        SimpleNamespace(course_id=303, status="ACTIVE"),
    ]
    db = FakeDB(rows)

    monkeypatch.setattr(
        student_api,
        "resolved_course_ids",
        lambda db, student_id: {101, 303},
    )

    resolved = student_api.resolved_student_courses(db, 7)

    assert [item.course_id for item in resolved] == [101, 303]


def test_resolved_student_courses_returns_no_stale_courses(monkeypatch) -> None:
    rows = [
        SimpleNamespace(course_id=101, status="ACTIVE"),
        SimpleNamespace(course_id=202, status="ACTIVE"),
    ]
    db = FakeDB(rows)

    monkeypatch.setattr(
        student_api,
        "resolved_course_ids",
        lambda db, student_id: {999},
    )

    assert student_api.resolved_student_courses(db, 7) == []

def test_student_course_read_uses_resolved_display_metadata(monkeypatch):
    student_course = SimpleNamespace(
        id=11,
        student_id=7,
        course_id=101,
        confidence=4,
        status="ACTIVE",
    )
    effective = SimpleNamespace(
        course_id=101,
        display_code="LOCAL-101",
        display_name="Local Physics",
        credit_hours=4,
    )

    data = student_api.student_course_read_data(
        FakeDB([]),
        student_course,
        metadata={101: effective},
    )

    assert data["course_id"] == 101
    assert data["course_code"] == "LOCAL-101"
    assert data["course_name"] == "Local Physics"
    assert data["credit_hours"] == 4


def test_student_course_read_rejects_missing_resolved_metadata():
    student_course = SimpleNamespace(
        id=11,
        student_id=7,
        course_id=101,
        confidence=4,
        status="ACTIVE",
    )

    with pytest.raises(
        Exception,
            match="Student course is no longer offered in the selected university stream",
    ):
        student_api.student_course_read_data(
            FakeDB([]),
            student_course,
            metadata={},
        )
