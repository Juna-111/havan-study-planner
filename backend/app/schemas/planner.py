from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class PlanGenerateRequest(BaseModel):
    student_id: int | None = Field(default=None, gt=0)
    horizon_days: int = Field(default=7, ge=1, le=14)


class StudyTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    plan_id: int
    course_id: int
    topic_id: int
    planned_date: date
    estimated_minutes: int
    priority: float
    reason: str
    status: str
    created_at: datetime


class StudyPlanDay(BaseModel):
    date: date
    total_minutes: int
    tasks: list[StudyTaskRead]


class StudyPlanRead(BaseModel):
    id: int
    student_id: int
    horizon_days: int
    created_at: datetime
    total_minutes: int
    days: list[StudyPlanDay]
    tasks: list[StudyTaskRead]


class StudyTaskUpdate(BaseModel):
    status: str = Field(pattern="^(RECOMMENDED|COMPLETED|SKIPPED|RESCHEDULED)$")
    planned_date: date | None = None
