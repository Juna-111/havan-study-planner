from datetime import datetime, timezone
from pydantic import BaseModel
class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: datetime
def make_health_response(service: str) -> HealthResponse:
    return HealthResponse(status="ok", service=service, timestamp=datetime.now(timezone.utc))
