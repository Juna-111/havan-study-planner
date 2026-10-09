from app.main import app
from app.schemas.academic_catalog import FreshmanCourseCreate, FreshmanCourseCategoryCreate
from app.services.freshman_registry import freshman_registry_key


def test_freshman_registry_routes_are_registered() -> None:
    paths = {route.path for route in app.routes}
    assert "/api/v1/freshman-registry/courses" in paths
    assert "/api/v1/university-course-mappings" in paths
    assert "/api/v1/freshman-mappings" not in paths
    assert "/api/v1/freshman-stream-assignments" not in paths
    assert "/api/v1/university-course-overrides" not in paths
    assert "/api/v1/freshman-templates" not in paths
    assert "/api/v1/freshman-registry/categories" in paths
    assert "/api/v1/freshman-registry-import/preview" in paths
    assert "/api/v1/freshman-registry-import/commit" in paths


def test_freshman_course_schema_has_no_university_dependency() -> None:
    item = FreshmanCourseCreate(
        code="Math 1011",
        name="Applied Mathematics I",
        content_version="1.0",
        category_codes=["NATURAL_SCIENCE"],
    )
    assert item.code == "Math 1011"
    assert item.category_codes == ["NATURAL_SCIENCE"]


def test_freshman_registry_key_is_stable_and_versioned() -> None:
    assert freshman_registry_key("Math 1011", "1.0") == "FRESHMAN:MATH 1011:1.0"
    assert freshman_registry_key("Math 1011", "2.0") != freshman_registry_key("Math 1011", "1.0")


def test_freshman_category_schema() -> None:
    item = FreshmanCourseCategoryCreate(
        code="COMMON_CORE",
        name="Common Core",
    )
    assert item.code == "COMMON_CORE"


def test_freshman_registry_import_parser_accepts_canonical_hierarchy() -> None:
    from app.services.freshman_registry_parser import parse_bullet_curriculum

    courses = parse_bullet_curriculum(
        """TYPE: COURSE_V1\nCourse: [PHY101] Physics
Chapter: Measurement
  • Physical quantities [3]
  • Units and dimensions [2]
Chapter: Vectors
  • Scalars and vectors [3]
  • Vector operations [4]
"""
    )

    assert len(courses) == 1
    assert courses[0].code == "PHY101"
    assert courses[0].name == "Physics"
    assert courses[0].chapters[1].topics[1].difficulty == 4


def test_freshman_registry_import_parser_rejects_missing_difficulty() -> None:
    import pytest
    from fastapi import HTTPException
    from app.services.freshman_registry_parser import parse_bullet_curriculum

    with pytest.raises(HTTPException):
        parse_bullet_curriculum(
            """Course: Physics
Chapter: Mechanics
  • Motion
"""
        )


def test_freshman_registry_import_parser_rejects_legacy_indented_format() -> None:
    from fastapi import HTTPException
    from app.services.freshman_registry_parser import parse_bullet_curriculum

    try:
        parse_bullet_curriculum(
            """• [PHY101] Physics
  • Measurement
    • Physical quantities [3]
"""
        )
    except HTTPException:
        return
    raise AssertionError("Legacy indented curriculum format must not be accepted.")




def test_course_source_files_preserve_complete_chapter_topic_hierarchy():
    from pathlib import Path
    from app.services.freshman_registry_parser import parse_bullet_curriculum

    root = Path(__file__).resolve().parents[2]
    expected = {
        "Natural_courses copy.md": (3, 24, 128),
        "Natural_courses2.md": (5, 35, 178),
        "Natural_courses3.md": (1, 6, 27),
    }

    for filename, counts in expected.items():
        parsed = parse_bullet_curriculum((root / filename).read_text(encoding="utf-8"))
        course_count = len(parsed)
        chapter_count = sum(len(course.chapters) for course in parsed)
        topic_count = sum(
            len(chapter.topics)
            for course in parsed
            for chapter in course.chapters
        )
        assert (course_count, chapter_count, topic_count) == counts
        assert all(
            chapter.topics
            for course in parsed
            for chapter in course.chapters
        )
