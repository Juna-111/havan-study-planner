from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


Weekday = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
PlanMode = Literal["today", "week", "month"]
PlanAction = Literal["START", "COMPLETE", "SKIP", "MOVE", "REPEAT", "REMOVE", "ADD"]


class TopicSelection(BaseModel):
    topic_id: int = Field(gt=0)
    known: bool = False


class PlanInput(BaseModel):
    mode: PlanMode = "week"
    horizon_days: int = Field(default=7, ge=1, le=31)
    topic_ids: list[int] = Field(min_length=1)
    known_topic_ids: list[int] = Field(default_factory=list)
    study_days: list[Weekday] = Field(default_factory=lambda: ["mon", "tue", "wed", "thu", "fri"])
    minutes_by_weekday: dict[Weekday, int] = Field(default_factory=dict)
    hours_per_day: float = Field(default=2.0, gt=0, le=24)
    pinned_topic_dates: dict[int, date] = Field(default_factory=dict)


class TaskOut(BaseModel):
    id: int
    course_id: int
    course_code: str
    course_name: str
    topic_id: int
    topic_name: str
    planned_date: date
    minutes: int
    priority: float
    reason: str
    reason_parts: list
    kind: str
    status: str
    pinned: bool


class ReadinessOut(BaseModel):
    course_id: int
    course_name: str
    exam_type: str
    exam_date: date
    days_left: int
    status: Literal["ON_TRACK", "TIGHT", "OVERLOADED"]
    required_minutes: int
    available_minutes: int
    shortfall_minutes: int
    extra_minutes_per_study_day: int


class WarningOut(BaseModel):
    code: str
    severity: Literal["info", "warn", "danger"]
    message: str
    fix: dict[str, str] = Field(default_factory=dict)


class UnplacedOut(BaseModel):
    topic_id: int
    topic_name: str
    course_id: int
    course_name: str
    minutes: int
    reason_code: str


class PlanOut(BaseModel):
    id: int | None
    student_id: int
    mode: PlanMode
    horizon_days: int
    start_date: date
    engine_version: str
    total_minutes: int
    tasks: list[TaskOut]
    readiness: list[ReadinessOut]
    warnings: list[WarningOut]
    unplaced: list[UnplacedOut]
    saved: bool = False
    created_at: datetime | None = None


class PlanAction(BaseModel):
    action: PlanAction
    target_date: date | None = None
    target_topic_id: int | None = Field(default=None, gt=0)
    actual_minutes: int | None = Field(default=None, gt=0)
    confidence: int | None = Field(default=None, ge=1, le=5)
    rebuild: bool = False
