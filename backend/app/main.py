from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.curriculum import router as curriculum_router
from app.api.curriculum_import import router as curriculum_import_router
from app.api.health import router as health_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging

settings = get_settings()
configure_logging()

app = FastAPI(
    title=settings.app_name,
    version="1.1.0",
    description="Backend foundation and academic curriculum API for Havan Study Planner.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # Vercel preview/production domains need CORS access during admin use.
    # Custom domains can still be added through CORS_ORIGINS.
    allow_origin_regex=r"^https://([a-zA-Z0-9-]+\.)*vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(curriculum_router)
app.include_router(curriculum_import_router)
register_exception_handlers(app)


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {"service": settings.app_name, "status": "running", "docs": "/docs"}
