from datetime import date
from pydantic import BaseModel, Field


class HavanPlanTaskInput(BaseModel):
    course_id: int = Field(gt=0)
    topic_id: int = Field(gt=0)
    planned_date: date
    minutes: int = Field(gt=0)


class HavanPlanCreate(BaseModel):
    mode: str = Field(pattern="^(today|week|month)$")
    horizon_days: int = Field(ge=1, le=31)
    study_days: list[int] = Field(default_factory=list)
    hours_per_day: dict[int, float] = Field(default_factory=dict)
    total_minutes: int = Field(ge=1)
    tasks: list[HavanPlanTaskInput] = Field(min_length=1)


class HavanPlanTaskRead(BaseModel):
    id: int
    course_id: int
    topic_id: int
    planned_date: date
    minutes: int
    academy_video_url: str | None = None
    academy_notes_url: str | None = None
    academy_questions_url: str | None = None
    freshman_question_count: int | None = None
    status: str


class HavanPlanRead(BaseModel):
    id: int
    student_id: int
    mode: str
    horizon_days: int
    study_days: list[int]
    hours_per_day: dict[int, float]
    total_minutes: int
    tasks: list[HavanPlanTaskRead]
