from app.main import app
from app.schemas.academic_catalog import TopicCreate, UniversityCreate


def test_academic_catalog_routes_are_registered_without_curriculum_layer() -> None:
    paths = {route.path for route in app.routes}
    assert "/api/v1/universities" in paths
    assert "/api/v1/curriculums" not in paths
    assert "/api/v1/streams" in paths
    assert "/api/v1/courses" in paths
    assert "/api/v1/chapters" in paths
    assert "/api/v1/topics" in paths
    assert "/api/v1/university-course-offerings" in paths
    assert "/api/v1/students/onboarding" in paths


def test_university_schema_validation() -> None:
    item = UniversityCreate(name="Addis Ababa University", code="AAU")
    assert item.code == "AAU"


def test_topic_schema_defaults_and_bounds() -> None:
    item = TopicCreate(chapter_id=1, name="Functions")
    assert item.difficulty == 3
    assert item.estimated_study_minutes == 30
    assert item.exam_importance == 0.5


def test_student_registration_schema_requires_courses() -> None:
    import pytest
    from pydantic import ValidationError
    from app.schemas.student import StudentRegistrationCreate

    with pytest.raises(ValidationError):
        StudentRegistrationCreate(
            name="Student",
            university_id=1,
            stream_id=1,
            study_days=["mon"],
            courses=[],
        )


def test_student_registration_schema_accepts_stream_and_selected_course() -> None:
    from app.schemas.student import StudentRegistrationCreate

    payload = StudentRegistrationCreate(
        name="Student",
        university_id=1,
        stream_id=1,
        study_days=["mon", "wed"],
        courses=[{"course_id": 10}],
    )

    assert payload.stream_id == 1
    assert payload.courses[0].course_id == 10
