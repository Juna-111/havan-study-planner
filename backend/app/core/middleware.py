"""ASGI middleware: request ID generation and Strict-Transport-Security header."""
from __future__ import annotations

import uuid
from contextvars import ContextVar
from typing import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import get_settings

request_id_var: ContextVar[str] = ContextVar("request_id_var", default="-")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attach a new UUID4 request id to each request and echo it as X-Request-ID."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = str(uuid.uuid4())
        token = request_id_var.set(request_id)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            request_id_var.reset(token)


class STSMiddleware(BaseHTTPMiddleware):
    """Add HSTS header when environment is production."""

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        response = await call_next(request)
        settings = get_settings()
        if settings.environment.strip().lower() == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        return response
