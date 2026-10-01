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
