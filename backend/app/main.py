from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.curriculum import router as curriculum_router
from app.api.curriculum_import import router as curriculum_import_router
from app.api.health import router as health_router
from app.api.student import router as student_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging

settings = get_settings()
configure_logging()

app = FastAPI(
    title=settings.app_name,
    version="1.2.0",
    description="Backend for Havan Study Planner: curriculum intelligence and student planning context.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"^https://[a-zA-Z0-9-]+.(?:netlify|vercel).app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(curriculum_router)
app.include_router(curriculum_import_router)
app.include_router(student_router)
register_exception_handlers(app)


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {"service": settings.app_name, "status": "running", "docs": "/docs"}
