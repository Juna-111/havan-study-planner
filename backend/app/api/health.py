from fastapi import APIRouter
from app.core.config import API_PREFIX, get_settings
from app.schemas.health import HealthResponse, make_health_response
router = APIRouter(tags=["system"])
@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse: return make_health_response(get_settings().app_name)
