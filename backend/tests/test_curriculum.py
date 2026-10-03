from app.main import app
from app.schemas.curriculum import TopicCreate, UniversityCreate


def test_curriculum_routes_are_registered() -> None:
    paths = {route.path for route in app.routes}
    assert "/api/v1/universities" in paths
    assert "/api/v1/curriculums" in paths
    assert "/api/v1/streams" in paths
    assert "/api/v1/courses" in paths
    assert "/api/v1/chapters" in paths
    assert "/api/v1/topics" in paths


def test_university_schema_validation() -> None:
    item = UniversityCreate(name="Addis Ababa University", code="AAU")
    assert item.code == "AAU"


def test_topic_schema_defaults_and_bounds() -> None:
    item = TopicCreate(chapter_id=1, name="Functions")
    assert item.difficulty == 3
    assert item.estimated_study_minutes == 60
    assert item.exam_importance == 0.5
