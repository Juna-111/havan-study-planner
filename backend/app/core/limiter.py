"""Rate limiting configuration using slowapi with in-process storage."""
from __future__ import annotations

from typing import Callable

from fastapi import Request, Response
from limits import storage, strategies
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    client = request.client
    return client.host if client else "unknown"


def _client_ip_and_email_factory(email_field: str = "email") -> Callable:
    def key(request: Request) -> str:
        ip = _client_ip(request)
        try:
            import asyncio
            if asyncio.iscoroutinefunction(request.json):
                body = request._body if hasattr(request, "_body") else b""
            else:
                body = b""
        except Exception:
            body = b""
        email_fragment = ""
        if body:
            try:
                import json
                data = json.loads(body.decode("utf-8")) if body else {}
                if isinstance(data, dict) and data.get(email_field):
                    email_fragment = ":" + str(data.get(email_field)).strip().lower()
            except Exception:
                pass
        return f"{ip}{email_fragment}"
    return key


limiter = Limiter(key_func=_client_ip, storage_uri="memory://", strategy="moving-window")


def auth_signup_key(request: Request) -> str:
    return _client_ip(request)


def auth_login_key(request: Request) -> str:
    return _client_ip(request)


def auth_forgot_key(request: Request) -> str:
    return _client_ip_and_email_factory("email")(request)


def _seconds_until_retry(limit_item) -> int:
    try:
        if hasattr(limit_item, "reset_at"):
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).timestamp()
            remaining = max(1, int(limit_item.reset_at - now))
            return remaining
    except Exception:
        pass
    return 60


def rate_limit_domain_error(exc: RateLimitExceeded):
    from app.core.errors import DomainError

    try:
        limit = getattr(exc, "limit", None)
        retry_after = _seconds_until_retry(limit) if limit else 60
    except Exception:
        retry_after = 60
    return (
        DomainError(
            "TOO_MANY_REQUESTS",
            "Too many requests. Please slow down and try again later.",
            429,
        ),
        retry_after,
    )


__all__ = [
    "limiter",
    "RateLimitExceeded",
    "rate_limit_domain_error",
    "auth_signup_key",
    "auth_login_key",
    "auth_forgot_key",
    "_client_ip",
]
