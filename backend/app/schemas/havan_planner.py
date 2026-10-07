from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class HavanPlanCreate(BaseModel):
    mode: Literal["today", "week", "month"]
    horizon_days: int = Field(ge=1, le=31)
    topic_ids: list[int] = Field(min_length=1, max_length=500)
    study_days: list[int] = Field(default_factory=list, max_length=7)
    hours_per_day: dict[int, float] = Field(default_factory=dict)


class HavanPromotionRead(BaseModel):
    id: int
    platform_name: str
    description: str | None = None
    button_text: str
    url: str
    status: str

class HavanPlanTaskRead(BaseModel):
    id: int
    course_id: int
    course_code: str
    course_name: str
    chapter_name: str
    topic_id: int
    topic_name: str
    planned_date: date
    minutes: int
    important_points: str | None = None
    academy_video_url: str | None = None
    academy_notes_url: str | None = None
    academy_questions_url: str | None = None
    freshman_question_count: int | None = None
    promotions: list[HavanPromotionRead] = Field(default_factory=list)
    status: str


class HavanPlanRead(BaseModel):
    id: int | None
    student_id: int
    mode: str
    horizon_days: int
    study_days: list[int]
    hours_per_day: dict[int, float]
    total_minutes: int
    tasks: list[HavanPlanTaskRead]


class HavanPlanTaskAction(BaseModel):
    action: Literal["START", "COMPLETE"]
