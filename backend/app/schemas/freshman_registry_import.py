from __future__ import annotations

from pydantic import BaseModel, Field


class ImportTopic(BaseModel):
    name: str = Field(min_length=2, max_length=250)
    difficulty: int = Field(ge=1, le=5)
    important_points: str | None = Field(default=None, max_length=10000)


class ImportChapter(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    topics: list[ImportTopic] = Field(min_length=1)


class FreshmanRegistryPreview(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=2, max_length=150)
    content_version: str = Field(default="1.0", min_length=1, max_length=30)
    category_codes: list[str] = Field(default_factory=list, max_length=3)
    chapters: list[ImportChapter] = Field(min_length=1)


class FreshmanRegistryResult(FreshmanRegistryPreview):
    course_id: int
    registry_key: str
    created_chapters: int
    created_topics: int
