from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.academic_quality import run_academic_quality_checks

router = APIRouter(prefix="/api/v1", tags=["academic-quality"])
DB = Annotated[Session, Depends(get_db)]


@router.get("/academic-quality")
def academic_quality(db: DB) -> dict:
    return run_academic_quality_checks(db)
