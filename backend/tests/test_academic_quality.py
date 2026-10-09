from types import SimpleNamespace

from app.services.academic_quality import run_academic_quality_checks


class FakeResult:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class FakeDB:
    def __init__(self, **data):
        self.data = {key: list(value) for key, value in data.items()}

    def scalars(self, statement):
        model = statement.column_descriptions[0]["type"].__name__
        names = {"University": "universities", "Stream": "streams", "Course": "courses", "Chapter": "chapters", "Topic": "topics", "UniversityCourseMapping": "mappings", "UniversityCourseOffering": "offerings"}
        return FakeResult(self.data[names[model]])


def university(id=1, status="ACTIVE"):
    return SimpleNamespace(id=id, name=f"University {id}", status=status)


def stream(id=1, university_id=1, status="ACTIVE"):
    return SimpleNamespace(id=id, university_id=university_id, name=f"Stream {id}", status=status)


def course(id=1, stream_id=1, status="ACTIVE", credit_hours=3):
    return SimpleNamespace(id=id, stream_id=stream_id, code=f"C{id}", status=status, credit_hours=credit_hours)


def chapter(id=1, course_id=1, status="ACTIVE"):
    return SimpleNamespace(id=id, course_id=course_id, name=f"Chapter {id}", status=status)


def topic(
    id=1,
    chapter_id=1,
    status="ACTIVE",
    name="Topic",
    difficulty=3,
    minutes=60,
    exam_importance=0.5,
    conceptual_importance=0.5,
    order_index=1,
):
    return SimpleNamespace(
        id=id,
        chapter_id=chapter_id,
        status=status,
        name=name,
        important_points="Key concept",
        difficulty=difficulty,
        estimated_study_minutes=minutes,
        exam_importance=exam_importance,
        conceptual_importance=conceptual_importance,
        order_index=order_index,
    )


def make_db(topics=(), **overrides):
    return FakeDB(
        universities=overrides.pop("universities", [university()]),
        streams=overrides.pop("streams", [stream()]),
        courses=overrides.pop("courses", [course()]),
        chapters=overrides.pop("chapters", [chapter()]),
        topics=topics,
        mappings=overrides.pop("mappings", []),
        offerings=overrides.pop("offerings", []),
        **overrides,
    )


def test_quality_detects_missing_active_topics():
    result = run_academic_quality_checks(make_db(topics=[]))
    assert any(issue["title"] == "Missing academic content" for issue in result["issues"])
    assert result["readiness"]["status"] == "warning"


def test_quality_detects_invalid_planner_topic_values():
    result = run_academic_quality_checks(
        make_db(
            topics=[
                topic(
                    difficulty=7,
                    minutes=0,
                    exam_importance=1.5,
                    conceptual_importance=-0.1,
                )
            ]
        )
    )
    titles = {issue["title"] for issue in result["issues"]}
    assert "Invalid difficulty" in titles
    assert "Invalid study time" in titles
    assert "Invalid exam importance" in titles
    assert "Invalid conceptual importance" in titles
    assert result["readiness"]["status"] == "error"


def test_quality_detects_inactive_parent_chain():
    result = run_academic_quality_checks(
        make_db(
            topics=[topic()],
            chapters=[chapter()],
            courses=[course()],
            streams=[stream(status="INACTIVE")],
        )
    )
    assert any(issue["title"] == "Inactive or missing stream" for issue in result["issues"])


def test_quality_marks_complete_sample_course_ready():
    result = run_academic_quality_checks(make_db(topics=[topic()]))
    assert result["readiness"]["status"] == "ready"
    assert result["readiness"]["ready_courses"] == 1

