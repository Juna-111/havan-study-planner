from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AcademicCatalogRequestCreate(BaseModel):
    request_type: str = Field(pattern=r"^(UNIVERSITY|STREAM)$")
    university_id: Optional[int] = Field(default=None, gt=0)
    name: str = Field(min_length=2, max_length=150)
    code: Optional[str] = Field(default=None, max_length=50)


class AcademicCatalogRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    request_type: str
    university_id: Optional[int]
    name: str
    code: Optional[str]
    status: str
    admin_note: Optional[str]
    created_at: datetime
    updated_at: datetime


class AcademicCatalogRequestReview(BaseModel):
    status: str = Field(pattern=r"^(APPROVED|REJECTED)$")
    admin_note: Optional[str] = Field(default=None, max_length=2000)
