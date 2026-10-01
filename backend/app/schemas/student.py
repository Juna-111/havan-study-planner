from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AuthSignup(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class AuthLogin(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class AuthAccountRead(BaseModel):
    id: int
    email: str
    student_profile_id: Optional[int] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    account: AuthAccountRead


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class StudentBase(BaseModel):
    client_key: str = Field(min_length=8, max_length=120)
    account_id: Optional[int] = Field(default=None, gt=0)
    name: str = Field(min_length=2, max_length=120)
    university_id: int = Field(gt=0)
    curriculum_id: int = Field(gt=0)
    stream_id: int = Field(gt=0)
    study_hours_per_day: float = Field(default=2.0, ge=0.5, le=12)
    study_days: list[int] = Field(default_factory=list, min_length=1, max_length=7)


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    university_id: Optional[int] = Field(default=None, gt=0)
    curriculum_id: Optional[int] = Field(default=None, gt=0)
    stream_id: Optional[int] = Field(default=None, gt=0)
    study_hours_per_day: Optional[float] = Field(default=None, ge=0.5, le=12)
    study_days: Optional[list[int]] = Field(default=None, min_length=1, max_length=7)


class StudentRead(StudentBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


class StudentCourseAdd(BaseModel):
    course_id: int = Field(gt=0)
    confidence: int = Field(default=3, ge=1, le=5)
    starting_chapter_id: Optional[int] = Field(default=None, gt=0)
    starting_topic_id: Optional[int] = Field(default=None, gt=0)


class StudentCourseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    course_id: int
    confidence: int
    status: str


class ProgressUpsert(BaseModel):
    status: str = Field(default="NOT_STARTED", pattern=r"^(NOT_STARTED|IN_PROGRESS|COMPLETED)$")
    confidence: int = Field(default=3, ge=1, le=5)
    notes: Optional[str] = None


class ProgressRead(ProgressUpsert):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    topic_id: int
    last_studied_at: Optional[datetime]
    completed_minutes: int
    study_sessions: int


class ExamCreate(BaseModel):
    course_id: int = Field(gt=0)
    exam_type: str = Field(min_length=2, max_length=30)
    exam_date: date
    importance: int = Field(default=3, ge=1, le=5)


class ExamUpdate(BaseModel):
    course_id: Optional[int] = Field(default=None, gt=0)
    exam_type: Optional[str] = Field(default=None, min_length=2, max_length=30)
    exam_date: Optional[date] = None
    importance: Optional[int] = Field(default=None, ge=1, le=5)


class ExamRead(ExamCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int


class CourseTopicStatus(BaseModel):
    course_id: int
    course_code: str
    course_name: str
    chapter_count: int
    active_topic_count: int


class StudentContext(BaseModel):
    profile: StudentRead
    courses: list[StudentCourseRead]
    progress: list[ProgressRead]
    exams: list[ExamRead]
    course_topic_status: list[CourseTopicStatus]
