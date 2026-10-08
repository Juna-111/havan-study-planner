from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from alembic.config import Config
from alembic.runtime.environment import EnvironmentContext
from alembic.script import ScriptDirectory

from app.core.config import API_PREFIX, get_settings
from app.db.session import engine
from app.schemas.health import HealthResponse, make_health_response

router = APIRouter(tags=["system"])


def _check_db() -> str:
    try:
        with engine.connect() as conn:
            conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        return "ok"
    except Exception:
        return "down"


def _migrations_pending() -> bool:
    try:
        ini_path = Path(__file__).resolve().parents[2] / "alembic.ini"
        alembic_cfg = Config(str(ini_path))
        script = ScriptDirectory.from_config(alembic_cfg)
        heads = {rev for rev in script.get_heads()}
        current_revs: set[str] = set()

        def _process_revision_context(rev, _context):
            current_revs.update(rev or ())
            return []

        with engine.connect() as connection:
            with EnvironmentContext(alembic_cfg, script, fn=_process_revision_context):
                EnvironmentContext.configure(connection=connection)
                with EnvironmentContext.begin_transaction():
                    EnvironmentContext.run_migrations()
    except Exception:
        return False
    if not heads or not current_revs:
        return bool(heads) and not current_revs
    return not current_revs.issuperset(heads)


@router.get("/health", response_model=HealthResponse)
def health() -> Any:
    db_status = _check_db()
    migrations_pending = False
    if db_status == "ok":
        try:
            migrations_pending = _migrations_pending()
        except Exception:
            migrations_pending = False

    status_text = "ok"
    http_status = 200
    if db_status == "down" or migrations_pending:
        status_text = "degraded"
        http_status = 503

    response = make_health_response(
        get_settings().app_name,
        db=db_status,
        migrations_pending=migrations_pending,
        version="1.2.0",
    )
    response.status = status_text
    if http_status == 200:
        return response
    content = response.model_dump(mode="json")
    content["timestamp"] = content["timestamp"]
    return JSONResponse(status_code=503, content=content)
