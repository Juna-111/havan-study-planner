from datetime import datetime, timezone
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: datetime
    db: str
    migrations_pending: bool
    version: str


def make_health_response(
    service: str,
    db: str = "ok",
    migrations_pending: bool = False,
    version: str = "1.2.0",
) -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=service,
        timestamp=datetime.now(timezone.utc),
        db=db,
        migrations_pending=migrations_pending,
        version=version,
    )
