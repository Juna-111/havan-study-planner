from app.main import app
from app.schemas.curriculum import FreshmanCourseCreate, FreshmanCourseCategoryCreate
from app.services.freshman_registry import freshman_registry_key


def test_freshman_registry_routes_are_registered() -> None:
    paths = {route.path for route in app.routes}
    assert "/api/v1/freshman-registry/courses" in paths
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
