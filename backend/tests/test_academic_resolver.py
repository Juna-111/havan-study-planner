from types import SimpleNamespace

from app.services.academic_resolver import resolve_stream_courses


class FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class FakeDB:
    def __init__(
        self,
        stream,
        direct_courses,
        mapping,
        freshman_rows,
        overrides,
        courses=None,
    ):
        self.stream = stream
        self.direct_courses = direct_courses
        self.mapping = mapping
        self.freshman_rows = freshman_rows
        self.overrides = overrides
        self.courses = courses or {}
        self._scalars_calls = 0

    def get(self, model, item_id):
        from app.db.models.curriculum import Course, Stream

        if model is Stream:
            return self.stream if item_id == self.stream.id else None
        if model is Course:
            return self.courses.get(item_id)
        return None

    def scalars(self, query):
        self._scalars_calls += 1
        if self._scalars_calls == 1:
            return FakeResult(self.direct_courses)
        return FakeResult(self.overrides)

    def scalar(self, query):
        return self.mapping

    def execute(self, query):
        return FakeResult(self.freshman_rows)


class StatusAwareFreshmanDB(FakeDB):
    def __init__(
        self,
        stream,
        national,
        mapping_status="ACTIVE",
        assignment_status="ACTIVE",
        template_status="ACTIVE",
    ):
        super().__init__(
            stream=stream,
            direct_courses=[],
            mapping=SimpleNamespace(template_id=30, status=mapping_status),
            freshman_rows=[],
            overrides=[],
        )
        self.national = national
        self.mapping_status = mapping_status
        self.assignment_status = assignment_status
        self.template_status = template_status

    def scalar(self, query):
        if self.mapping_status.upper() != "ACTIVE":
            return None
        return self.mapping

    def execute(self, query):
        if (
            self.assignment_status.upper() != "ACTIVE"
            or self.template_status.upper() != "ACTIVE"
        ):
            return FakeResult([])
        return FakeResult([(self.national, 1, 1, "REQUIRED")])


def test_resolver_applies_stream_mapping_and_university_overrides() -> None:
    stream = SimpleNamespace(id=10, curriculum_id=20)

    national = SimpleNamespace(
        id=101, code="PHY101", name="Physics", credit_hours=4, status="ACTIVE"
    )
    local = SimpleNamespace(
        id=202, code="BIO-L", name="Local Biology", credit_hours=3, status="ACTIVE"
    )

    placement = SimpleNamespace(id=301, order_index=2, requirement_type="REQUIRED")
    freshman_row = (national, 1, placement.order_index, placement.requirement_type)

    overrides = [
        SimpleNamespace(
            override_type="MOVE",
            national_course_id=101,
            source_stream_id=10,
            target_stream_id=None,
            semester_number=2,
            order_index=1,
            local_course_id=None,
            local_code=None,
            local_title=None,
            local_credit_hours=None,
        ),
        SimpleNamespace(
            override_type="METADATA",
            national_course_id=101,
            source_stream_id=None,
            target_stream_id=None,
            semester_number=None,
            order_index=None,
            local_course_id=None,
            local_code="PHY-LOCAL",
            local_title="Physics (University)",
            local_credit_hours=5,
        ),
        SimpleNamespace(
            override_type="ADD",
            national_course_id=None,
            source_stream_id=None,
            target_stream_id=10,
            semester_number=1,
            order_index=3,
            local_course_id=202,
            local_code=None,
            local_title=None,
            local_credit_hours=None,
        ),
    ]

    db = FakeDB(
        stream=stream,
        direct_courses=[],
        mapping=SimpleNamespace(template_id=30, status="ACTIVE"),
        freshman_rows=[freshman_row],
        overrides=overrides,
        courses={202: local},
    )

    resolved = resolve_stream_courses(db, stream.id)

    assert [item.course_id for item in resolved] == [202, 101]
    moved = next(item for item in resolved if item.course_id == 101)
    assert moved.semester_number == 2
    assert moved.order_index == 1
    assert moved.display_code == "PHY-LOCAL"
    assert moved.display_name == "Physics (University)"
    assert moved.credit_hours == 5


def test_resolver_remove_override_removes_inherited_course() -> None:
    stream = SimpleNamespace(id=10, curriculum_id=20)
    national = SimpleNamespace(
        id=101, code="PHY101", name="Physics", credit_hours=4, status="ACTIVE"
    )
    overrides = [
        SimpleNamespace(
            override_type="REMOVE",
            national_course_id=101,
            source_stream_id=10,
            target_stream_id=None,
            semester_number=None,
            order_index=None,
            local_course_id=None,
            local_code=None,
            local_title=None,
            local_credit_hours=None,
        )
    ]

    db = FakeDB(
        stream=stream,
        direct_courses=[],
        mapping=SimpleNamespace(template_id=30, status="ACTIVE"),
        freshman_rows=[(national, 1, 1, "REQUIRED")],
        overrides=overrides,
    )

    assert resolve_stream_courses(db, stream.id) == []


def test_resolver_change_stream_removes_course_from_source_stream() -> None:
    source_stream = SimpleNamespace(id=10, curriculum_id=20)
    national = SimpleNamespace(
        id=101, code="PHY101", name="Physics", credit_hours=4, status="ACTIVE"
    )
    override = SimpleNamespace(
        override_type="CHANGE_STREAM",
        national_course_id=101,
        source_stream_id=10,
        target_stream_id=20,
        semester_number=2,
        order_index=4,
        local_course_id=None,
        local_code=None,
        local_title=None,
        local_credit_hours=None,
    )

    db = FakeDB(
        stream=source_stream,
        direct_courses=[],
        mapping=SimpleNamespace(template_id=30, status="ACTIVE"),
        freshman_rows=[(national, 1, 1, "REQUIRED")],
        overrides=[override],
    )

    assert resolve_stream_courses(db, source_stream.id) == []


def test_resolver_change_stream_adds_course_to_target_stream() -> None:
    target_stream = SimpleNamespace(id=20, curriculum_id=20)
    national = SimpleNamespace(
        id=101, code="PHY101", name="Physics", credit_hours=4, status="ACTIVE"
    )
    override = SimpleNamespace(
        override_type="CHANGE_STREAM",
        national_course_id=101,
        source_stream_id=10,
        target_stream_id=20,
        semester_number=2,
        order_index=4,
        local_course_id=None,
        local_code=None,
        local_title=None,
        local_credit_hours=None,
    )

    db = FakeDB(
        stream=target_stream,
        direct_courses=[],
        mapping=SimpleNamespace(template_id=30, status="ACTIVE"),
        freshman_rows=[],
        overrides=[override],
        courses={101: national},
    )

    resolved = resolve_stream_courses(db, target_stream.id)

    assert len(resolved) == 1
    assert resolved[0].course_id == 101
    assert resolved[0].semester_number == 2
    assert resolved[0].order_index == 4
    assert resolved[0].display_code == "PHY101"
    assert resolved[0].display_name == "Physics"
    assert resolved[0].credit_hours == 4


def test_resolver_ignores_inactive_curriculum_mapping() -> None:
    stream = SimpleNamespace(id=10, curriculum_id=20)
    national = SimpleNamespace(
        id=101, code="PHY101", name="Physics", credit_hours=4, status="ACTIVE"
    )

    db = StatusAwareFreshmanDB(
        stream=stream,
        national=national,
        mapping_status="ARCHIVED",
    )

    assert resolve_stream_courses(db, stream.id) == []


def test_resolver_ignores_inactive_stream_assignment() -> None:
    stream = SimpleNamespace(id=10, curriculum_id=20)
    national = SimpleNamespace(
        id=101, code="PHY101", name="Physics", credit_hours=4, status="ACTIVE"
    )

    db = StatusAwareFreshmanDB(
        stream=stream,
        national=national,
        assignment_status="ARCHIVED",
    )

    assert resolve_stream_courses(db, stream.id) == []


def test_resolver_ignores_inactive_curriculum_template() -> None:
    stream = SimpleNamespace(id=10, curriculum_id=20)
    national = SimpleNamespace(
        id=101, code="PHY101", name="Physics", credit_hours=4, status="ACTIVE"
    )

    db = StatusAwareFreshmanDB(
        stream=stream,
        national=national,
        template_status="ARCHIVED",
    )

    assert resolve_stream_courses(db, stream.id) == []
