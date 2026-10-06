from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UniversityBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    code: Optional[str] = Field(default=None, min_length=2, max_length=30, pattern=r"^[A-Za-z0-9_-]+$")
    description: Optional[str] = None
    status: str = Field(default="ACTIVE", pattern=r"^(ACTIVE|INACTIVE)$")
class UniversityCreate(UniversityBase): pass
class UniversityUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    code: Optional[str] = Field(default=None, min_length=2, max_length=30, pattern=r"^[A-Za-z0-9_-]+$")
    description: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern=r"^(ACTIVE|INACTIVE)$")
class UniversityRead(ORMModel):
    id: int; name: str; code: str; description: Optional[str]; status: str; created_at: datetime; updated_at: datetime


class CurriculumBase(BaseModel):
    university_id: int = Field(gt=0)
    name: str = Field(min_length=2, max_length=150)
    version: str = Field(min_length=1, max_length=50)
    academic_year: Optional[str] = Field(default=None, max_length=30)
    description: Optional[str] = None
    status: str = Field(default="DRAFT", pattern=r"^(DRAFT|ACTIVE|ARCHIVED)$")
class CurriculumCreate(CurriculumBase): pass
class CurriculumUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    version: Optional[str] = Field(default=None, min_length=1, max_length=50)
    academic_year: Optional[str] = Field(default=None, max_length=30)
    description: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern=r"^(DRAFT|ACTIVE|ARCHIVED)$")
class CurriculumRead(ORMModel):
    id: int; university_id: int; name: str; version: str; academic_year: Optional[str]; description: Optional[str]; status: str; created_at: datetime; updated_at: datetime


class StreamBase(BaseModel):
    curriculum_id: int = Field(gt=0)
    name: str = Field(min_length=2, max_length=100)
    code: str = Field(min_length=1, max_length=30, pattern=r"^[A-Za-z0-9_-]+$")
    description: Optional[str] = None
    status: str = Field(default="ACTIVE", pattern=r"^(ACTIVE|INACTIVE)$")
class StreamCreate(StreamBase): pass
class StreamUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    code: Optional[str] = Field(default=None, min_length=1, max_length=30, pattern=r"^[A-Za-z0-9_-]+$")
    description: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern=r"^(ACTIVE|INACTIVE)$")
class StreamRead(ORMModel):
    id: int; curriculum_id: int; name: str; code: str; description: Optional[str]; status: str


class FreshmanCourseCategoryBase(BaseModel):
    code: str = Field(min_length=2, max_length=30, pattern=r"^[A-Z0-9_-]+$")
    name: str = Field(min_length=2, max_length=100)
    description: Optional[str] = None

class FreshmanCourseCategoryCreate(FreshmanCourseCategoryBase): pass

class FreshmanCourseCategoryUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=2, max_length=30, pattern=r"^[A-Z0-9_-]+$")
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    description: Optional[str] = None

class FreshmanCourseCategoryRead(ORMModel):
    id: int
    code: str
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime


class FreshmanCourseCreate(BaseModel):
    code: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_. -]+$")
    name: str = Field(min_length=2, max_length=150)
    description: Optional[str] = None
    credit_hours: Optional[int] = Field(default=None, ge=0, le=30)
    content_version: str = Field(default="1.0", min_length=1, max_length=30)
    status: str = Field(default="ACTIVE", pattern=r"^(ACTIVE|INACTIVE)$")
    category_codes: list[str] = Field(default_factory=list, max_length=3)


class FreshmanCourseUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_. -]+$")
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = None
    credit_hours: Optional[int] = Field(default=None, ge=0, le=30)
    content_version: Optional[str] = Field(default=None, min_length=1, max_length=30)
    status: Optional[str] = Field(default=None, pattern=r"^(ACTIVE|INACTIVE)$")
    category_codes: Optional[list[str]] = Field(default=None, max_length=3)


class FreshmanCourseRead(ORMModel):
    id: int
    code: str
    name: str
    description: Optional[str]
    credit_hours: Optional[int]
    academic_scope: str
    registry_key: str
    content_version: str
    status: str
    category_codes: list[str] = Field(default_factory=list)


class CourseBase(BaseModel):
    stream_id: int = Field(gt=0)
    code: str = Field(min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_.-]+$")
    name: str = Field(min_length=2, max_length=150)
    description: Optional[str] = None
    credit_hours: Optional[int] = Field(default=None, ge=0, le=30)
    status: str = Field(default="ACTIVE", pattern=r"^(ACTIVE|INACTIVE)$")
class CourseCreate(CourseBase): pass
class CourseUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=40, pattern=r"^[A-Za-z0-9_.-]+$")
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = None
    credit_hours: Optional[int] = Field(default=None, ge=0, le=30)
    status: Optional[str] = Field(default=None, pattern=r"^(ACTIVE|INACTIVE)$")
class CourseRead(ORMModel):
    id: int; stream_id: Optional[int]; code: str; name: str; description: Optional[str]; credit_hours: Optional[int]; status: str


class ChapterBase(BaseModel):
    course_id: int = Field(gt=0)
    name: str = Field(min_length=2, max_length=200)
    description: Optional[str] = None
    important_points: Optional[str] = Field(default=None, max_length=10000)
    order_index: int = Field(ge=1)
    status: str = Field(default="ACTIVE", pattern=r"^(ACTIVE|INACTIVE)$")
class ChapterCreate(ChapterBase): pass
class ChapterUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    description: Optional[str] = None
    important_points: Optional[str] = Field(default=None, max_length=10000)
    order_index: Optional[int] = Field(default=None, ge=1)
    status: Optional[str] = Field(default=None, pattern=r"^(ACTIVE|INACTIVE)$")
class ChapterRead(ORMModel):
    id: int; course_id: int; name: str; description: Optional[str]; important_points: Optional[str]; order_index: int; status: str


class TopicBase(BaseModel):
    chapter_id: int = Field(gt=0)
    name: str = Field(min_length=2, max_length=250)
    description: Optional[str] = None
    important_points: Optional[str] = Field(default=None, max_length=10000)
    difficulty: int = Field(default=3, ge=1, le=5)
    estimated_study_minutes: int = Field(default=60, gt=0, le=1440)
    exam_importance: float = Field(default=0.5, ge=0, le=1)
    conceptual_importance: float = Field(default=0.5, ge=0, le=1)
    order_index: int = Field(default=1, ge=1)
    status: str = Field(default="ACTIVE", pattern=r"^(ACTIVE|INACTIVE)$")
class TopicCreate(TopicBase): pass
class TopicUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=250)
    description: Optional[str] = None
    important_points: Optional[str] = Field(default=None, max_length=10000)
    difficulty: Optional[int] = Field(default=None, ge=1, le=5)
    estimated_study_minutes: Optional[int] = Field(default=None, gt=0, le=1440)
    exam_importance: Optional[float] = Field(default=None, ge=0, le=1)
    conceptual_importance: Optional[float] = Field(default=None, ge=0, le=1)
    order_index: Optional[int] = Field(default=None, ge=1)
    status: Optional[str] = Field(default=None, pattern=r"^(ACTIVE|INACTIVE)$")
class TopicRead(ORMModel):
    id: int; chapter_id: int; name: str; description: Optional[str]; important_points: Optional[str]; difficulty: int; estimated_study_minutes: int; exam_importance: float; conceptual_importance: float; order_index: int; status: str


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int
    pages: int


class UniversityCourseMappingCreate(BaseModel):
    stream_id: int = Field(gt=0)
    course_id: int = Field(gt=0)
    semester_number: int = Field(ge=1, le=2)
    order_index: int = Field(default=1, ge=1)
    status: str = Field(default="DRAFT", pattern=r"^(DRAFT|ACTIVE|ARCHIVED)$")


class UniversityCourseMappingUpdate(BaseModel):
    semester_number: Optional[int] = Field(default=None, ge=1, le=2)
    order_index: Optional[int] = Field(default=None, ge=1)
    status: Optional[str] = Field(default=None, pattern=r"^(DRAFT|ACTIVE|ARCHIVED)$")


class UniversityCourseMappingRead(BaseModel):
    id: int
    curriculum_id: int
    curriculum_name: str
    curriculum_version: str
    university_id: int
    university_name: str
    stream_id: int
    stream_name: str
    stream_code: str
    course_id: int
    course_code: str
    course_name: str
    credit_hours: Optional[int]
    semester_number: int
    order_index: int
    status: str
    created_at: datetime
    updated_at: datetime


