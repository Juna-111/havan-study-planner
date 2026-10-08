"""Logging configuration with JSON formatter in production and Sentry integration."""
from __future__ import annotations

import logging
import os

from .config import get_settings


def configure_logging() -> None:
    settings = get_settings()
    env = settings.environment.strip().lower()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    root = logging.getLogger()
    root.setLevel(level)

    if env == "development":
        fmt = logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s")
        if not root.handlers:
            stream = logging.StreamHandler()
            stream.setFormatter(fmt)
            root.addHandler(stream)
        else:
            for h in root.handlers:
                h.setFormatter(fmt)
    else:
        try:
            from pythonjsonlogger import jsonlogger

            fmt = jsonlogger.JsonFormatter(
                "%(asctime)s %(levelname)s %(name)s %(request_id)s %(message)s %(exc_info)s",
                rename_fields={
                    "levelname": "levelname",
                    "asctime": "asctime",
                    "name": "name",
                    "request_id": "request_id",
                    "message": "message",
                    "exc_info": "exc_info",
                },
                timestamp=True,
            )
            if not root.handlers:
                stream = logging.StreamHandler()
                stream.setFormatter(fmt)
                root.addHandler(stream)
            else:
                for h in root.handlers:
                    h.setFormatter(fmt)
        except Exception:
            fallback = logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s")
            if not root.handlers:
                stream = logging.StreamHandler()
                stream.setFormatter(fallback)
                root.addHandler(stream)

    sentry_dsn = os.environ.get("SENTRY_DSN") or os.getenv("SENTRY_DSN")
    if sentry_dsn:
        try:
            import sentry_sdk

            sentry_sdk.init(
                dsn=sentry_dsn,
                traces_sample_rate=0.1,
                environment=settings.environment,
                send_default_pii=False,
            )
        except Exception:
            pass

