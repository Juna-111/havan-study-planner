from fastapi import APIRouter

from app.api.academic_quality import router as academic_quality_router
from app.api.admin_file_import import router as admin_file_import_router
from app.api.academic_catalog_requests import router as academic_catalog_requests_router
from app.api.auth import router as auth_router
from app.api.curriculum import router as curriculum_router
from app.api.freshman_registry import router as freshman_registry_router
from app.api.freshman_registry_import import router as freshman_registry_import_router
from app.api.health import router as health_router
from app.api.havan_planner import router as havan_planner_router
from app.api.plans import router as plans_router
from app.api.student import router as student_router
from app.api.university_course_mappings import router as university_course_mappings_router

router = APIRouter()

for child_router in (
    health_router,
    havan_planner_router,
    auth_router,
    curriculum_router,
    freshman_registry_router,
    freshman_registry_import_router,
    university_course_mappings_router,
    student_router,
    plans_router,
    academic_quality_router,
    admin_file_import_router,
    academic_catalog_requests_router,
):
    router.include_router(child_router)
