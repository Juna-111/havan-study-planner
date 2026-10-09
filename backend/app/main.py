import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.router import router as api_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.limiter import limiter
from app.core.logging import configure_logging
from app.core.middleware import RequestIDMiddleware, STSMiddleware

settings = get_settings()
configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    async def notification_loop():
        while True:
            try:
                from app.services.notifications import dispatch_due_notifications
                await asyncio.to_thread(dispatch_due_notifications)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Notification reminder cycle failed")
            await asyncio.sleep(60)

    task = asyncio.create_task(notification_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

app = FastAPI(
    title=settings.app_name,
    version="1.2.0",
    description="Backend for Havan Study Planner: curriculum intelligence and student planning context.",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(STSMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "HEAD", "OPTIONS", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID"],
)
app.include_router(api_router)
register_exception_handlers(app)


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {"service": settings.app_name, "status": "running", "docs": "/docs"}
