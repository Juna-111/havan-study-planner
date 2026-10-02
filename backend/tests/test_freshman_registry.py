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


def test_freshman_template_routes_are_registered() -> None:
    paths = {route.path for route in app.routes}
    assert "/api/v1/freshman-templates" in paths
    assert "/api/v1/freshman-templates/{template_id}" in paths
    assert "/api/v1/freshman-templates/{template_id}/courses" in paths
    assert "/api/v1/freshman-templates/{template_id}/courses/{placement_id}" in paths


def test_freshman_template_schema_requires_two_semesters() -> None:
    from app.schemas.curriculum import FreshmanCurriculumTemplateCreate

    item = FreshmanCurriculumTemplateCreate(
        code="NATIONAL-2026",
        name="National Freshman Curriculum",
        version="1.0",
        semesters=[
            {"semester_number": 1, "name": "Semester I"},
            {"semester_number": 2, "name": "Semester II"},
        ],
    )
    assert [semester.semester_number for semester in item.semesters] == [1, 2]


def test_freshman_template_course_is_a_registry_reference() -> None:
    from app.schemas.curriculum import FreshmanTemplateCourseAssignment

    assignment = FreshmanTemplateCourseAssignment(
        semester_number=1,
        course_id=42,
        requirement_type="REQUIRED",
        order_index=1,
    )
    assert assignment.course_id == 42
    assert assignment.semester_number == 1


def test_freshman_mapping_routes_are_registered() -> None:
    paths = {route.path for route in app.routes}
    assert "/api/v1/freshman-mappings" in paths
    assert "/api/v1/freshman-mappings/{mapping_id}" in paths


def test_freshman_mapping_schema_links_university_curriculum_to_template() -> None:
    from app.schemas.curriculum import FreshmanCurriculumMappingCreate

    item = FreshmanCurriculumMappingCreate(
        curriculum_id=7,
        template_id=3,
        status="DRAFT",
    )
    assert item.curriculum_id == 7
    assert item.template_id == 3


def test_freshman_stream_assignment_routes_are_registered() -> None:
    paths = {route.path for route in app.routes}
    assert "/api/v1/freshman-stream-assignments" in paths
    assert "/api/v1/freshman-stream-assignments/{assignment_id}" in paths


def test_freshman_stream_assignment_schema_links_stream_to_template_course() -> None:
    from app.schemas.curriculum import FreshmanStreamCourseAssignmentCreate

    item = FreshmanStreamCourseAssignmentCreate(
        stream_id=11,
        template_course_id=22,
        status="DRAFT",
    )
    assert item.stream_id == 11
    assert item.template_course_id == 22
