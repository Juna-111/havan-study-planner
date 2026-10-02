from __future__ import annotations

from pydantic import BaseModel, Field


class ImportTopic(BaseModel):
    name: str = Field(min_length=2, max_length=250)
    difficulty: int = Field(ge=1, le=5)


class ImportChapter(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    topics: list[ImportTopic] = Field(min_length=1)


class ImportCourse(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    code: str = Field(min_length=1, max_length=40)
    chapters: list[ImportChapter] = Field(min_length=1)


class CurriculumImportPreview(BaseModel):
    university_id: int = Field(gt=0)
    curriculum_id: int = Field(gt=0)
    stream_id: int = Field(gt=0)
    courses: list[ImportCourse] = Field(min_length=1)


class CurriculumImportResult(CurriculumImportPreview):
    created_courses: int
    created_chapters: int
    created_topics: int


class FullImportTopic(BaseModel):
    name: str = Field(min_length=2, max_length=250)
    difficulty: int = Field(default=3, ge=1, le=5)


class FullImportChapter(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    topics: list[FullImportTopic] = Field(min_length=1)


class FullImportCourse(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    code: str = Field(min_length=1, max_length=40)
    chapters: list[FullImportChapter] = Field(min_length=1)


class FullStructurePreview(BaseModel):
    university_name: str = Field(min_length=2, max_length=150)
    university_code: str = Field(min_length=2, max_length=30)
    university_description: str | None = None
    curriculum_name: str = Field(min_length=2, max_length=150)
    curriculum_version: str = Field(min_length=1, max_length=50)
    academic_year: str | None = None
    curriculum_description: str | None = None
    stream_name: str = Field(min_length=2, max_length=100)
    stream_code: str = Field(min_length=1, max_length=30)
    stream_description: str | None = None
    courses: list[FullImportCourse] = Field(min_length=1)


class FullStructureResult(FullStructurePreview):
    university_id: int
    curriculum_id: int
    stream_id: int
    created_university: bool = False
    reused_curriculum: bool = False
    reused_stream: bool = False
    created_courses: int
    reused_courses: int = 0
    created_chapters: int
    reused_chapters: int = 0
    created_topics: int
    skipped_topics: int = 0
