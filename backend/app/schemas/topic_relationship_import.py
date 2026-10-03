from __future__ import annotations

from pydantic import BaseModel, Field


class TopicRelationshipImportItem(BaseModel):
    line_number: int | None = Field(default=None, ge=1)
    source_ref: str = Field(min_length=3, max_length=100)
    target_ref: str = Field(min_length=3, max_length=100)
    relationship_type: str = Field(pattern=r"^(prerequisite|conceptual|cross_course|related|revision)$")
    strength: float = Field(ge=0, le=1)
    notes: str | None = Field(default=None, max_length=2000)


class TopicRelationshipPreviewItem(TopicRelationshipImportItem):
    line_number: int = Field(ge=1)
    source_topic_id: int
    target_topic_id: int
    source_course_code: str
    target_course_code: str
    source_topic_name: str
    target_topic_name: str
    existing: bool = False


class TopicRelationshipImportCommit(BaseModel):
    items: list[TopicRelationshipImportItem] = Field(min_length=1, max_length=5000)


class TopicRelationshipImportResult(BaseModel):
    created: int
    skipped_existing: int
    relationships: list[TopicRelationshipPreviewItem]
