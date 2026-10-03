from types import SimpleNamespace

from app.services.academic_resolver import resolve_stream_courses


class FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return list(self.rows)


class FakeDB:
    def __init__(self, stream, rows):
        self.stream = stream
        self.rows = rows

    def get(self, model, item_id):
        from app.db.models.curriculum import Stream
        if model is Stream and item_id == self.stream.id:
            return self.stream
        return None

    def execute(self, query):
        return FakeResult(self.rows)


def mapping(course_id: int, semester: int, order: int = 1):
    return SimpleNamespace(
        id=course_id,
        course_id=course_id,
        stream_id=10,
        curriculum_id=20,
        semester_number=semester,
        order_index=order,
        status="ACTIVE",
    )


def course(course_id: int, code: str, name: str, credits: int):
    return SimpleNamespace(
        id=course_id,
        code=code,
        name=name,
        credit_hours=credits,
        status="ACTIVE",
    )


def test_resolver_uses_direct_university_semester_mappings():
    stream = SimpleNamespace(id=10, curriculum_id=20, status="ACTIVE")
    rows = [
        (mapping(101, 2, 2), course(101, "PHY101", "Physics", 4)),
        (mapping(202, 1, 1), course(202, "CHE101", "Chemistry", 5)),
    ]

    resolved = resolve_stream_courses(FakeDB(stream, rows), stream.id)

    assert [item.course_id for item in resolved] == [202, 101]
    assert resolved[0].semester_number == 1
    assert resolved[1].semester_number == 2


def test_resolver_preserves_course_catalog_metadata():
    stream = SimpleNamespace(id=10, curriculum_id=20, status="ACTIVE")
    rows = [
        (mapping(101, 1), course(101, "PHY101", "Physics", 4)),
    ]

    resolved = resolve_stream_courses(FakeDB(stream, rows), stream.id)

    assert resolved[0].display_code == "PHY101"
    assert resolved[0].display_name == "Physics"
    assert resolved[0].credit_hours == 4


def test_resolver_returns_no_courses_for_inactive_stream():
    stream = SimpleNamespace(id=10, curriculum_id=20, status="ARCHIVED")
    rows = [
        (mapping(101, 1), course(101, "PHY101", "Physics", 4)),
    ]

    assert resolve_stream_courses(FakeDB(stream, rows), stream.id) == []
