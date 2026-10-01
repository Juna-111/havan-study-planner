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
        names = {"University": "universities", "Curriculum": "curriculums", "Stream": "streams", "Course": "courses", "Chapter": "chapters", "Topic": "topics", "TopicRelationship": "relationships"}
        return FakeResult(self.data[names[model]])


def university(id=1, status="ACTIVE"):
    return SimpleNamespace(id=id, name=f"University {id}", status=status)


def curriculum(id=1, university_id=1, status="ACTIVE"):
    return SimpleNamespace(id=id, university_id=university_id, name=f"Curriculum {id}", status=status)


def stream(id=1, curriculum_id=1, status="ACTIVE"):
    return SimpleNamespace(id=id, curriculum_id=curriculum_id, name=f"Stream {id}", status=status)


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
        difficulty=difficulty,
        estimated_study_minutes=minutes,
        exam_importance=exam_importance,
        conceptual_importance=conceptual_importance,
        order_index=order_index,
    )


def relationship(id, source, target, relationship_type="prerequisite", strength=1.0):
    return SimpleNamespace(
        id=id,
        source_topic_id=source,
        target_topic_id=target,
        relationship_type=relationship_type,
        strength=strength,
    )


def make_db(topics=(), relationships=(), **overrides):
    return FakeDB(
        universities=overrides.pop("universities", [university()]),
        curriculums=overrides.pop("curriculums", [curriculum()]),
        streams=overrides.pop("streams", [stream()]),
        courses=overrides.pop("courses", [course()]),
        chapters=overrides.pop("chapters", [chapter()]),
        topics=topics,
        relationships=relationships,
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


def test_quality_detects_prerequisite_cycle():
    result = run_academic_quality_checks(
        make_db(
            topics=[topic(id=1), topic(id=2, order_index=2)],
            relationships=[
                relationship(1, 1, 2),
                relationship(2, 2, 1),
            ],
        )
    )
    cycle_issues = [issue for issue in result["issues"] if issue["title"] == "Prerequisite cycle detected"]
    assert {issue["entity_id"] for issue in cycle_issues} == {1, 2}
    assert result["readiness"]["status"] == "error"


def test_quality_marks_complete_sample_course_ready():
    result = run_academic_quality_checks(make_db(topics=[topic()]))
    assert result["readiness"]["status"] == "ready"
    assert result["readiness"]["ready_courses"] == 1


def test_quality_detects_duplicate_topic_relationship():
    result = run_academic_quality_checks(
        make_db(
            topics=[topic(id=1), topic(id=2, order_index=2)],
            relationships=[
                relationship(1, 1, 2),
                relationship(2, 1, 2),
            ],
        )
    )
    assert any(issue["title"] == "Duplicate topic relationship" for issue in result["issues"])
