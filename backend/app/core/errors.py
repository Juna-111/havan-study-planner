import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger(__name__)


class DomainError(Exception):
    def __init__(self, code: str, message: str, status: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


class PlanValidationError(DomainError):
    """A user-fixable planning input error, distinct from unexpected bugs."""


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def domain_error(request: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status,
            content={"detail": exc.message, "code": exc.code},
        )

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_exceeded(request: Request, exc: RateLimitExceeded) -> JSONResponse:
        from app.core.limiter import rate_limit_domain_error

        domain_exc, retry_after = rate_limit_domain_error(exc)
        response = JSONResponse(
            status_code=domain_exc.status,
            content={"detail": domain_exc.message, "code": domain_exc.code},
        )
        response.headers["Retry-After"] = str(retry_after)
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = []
        for error in exc.errors():
            location = [str(part) for part in error.get("loc", ()) if part != "body"]
            errors.append({
                "field": ".".join(location) if location else "request",
                "message": error.get("msg", "Invalid value"),
                "type": error.get("type", "validation_error"),
            })
        return JSONResponse(
            status_code=422,
            content={"detail": errors, "code": "INVALID_INPUT"},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled request error: %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error", "code": "INTERNAL_ERROR"})
