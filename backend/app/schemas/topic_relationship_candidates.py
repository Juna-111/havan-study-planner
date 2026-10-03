from __future__ import annotations

from pydantic import BaseModel, Field


class TopicCatalogItem(BaseModel):
    topic_identity: str
    course_code: str
    course_name: str
    registry_key: str
    content_version: str
    chapter_name: str
    chapter_order: int
    topic_name: str
    topic_order: int
    difficulty: int
    estimated_study_minutes: int
    exam_importance: float
    conceptual_importance: float


class TopicCatalogResponse(BaseModel):
    catalog_version: str = "1"
    identity_rule: str
    count: int
    items: list[TopicCatalogItem]


class TopicRelationshipCandidate(BaseModel):
    source_topic_identity: str = Field(min_length=5, max_length=700)
    target_topic_identity: str = Field(min_length=5, max_length=700)
    relationship_type: str = Field(pattern=r"^(prerequisite|conceptual|cross_course|related|revision)$")
    strength: float = Field(ge=0, le=1)
    confidence: float = Field(default=1.0, ge=0, le=1)
    notes: str | None = Field(default=None, max_length=2000)


class TopicRelationshipCandidateBatch(BaseModel):
    candidates: list[TopicRelationshipCandidate] = Field(min_length=1, max_length=5000)


class TopicRelationshipCandidatePreview(BaseModel):
    source_topic_identity: str
    target_topic_identity: str
    relationship_type: str
    strength: float
    confidence: float
    notes: str | None
    source_topic_id: int | None
    target_topic_id: int | None
    source_course_code: str | None
    target_course_code: str | None
    source_topic_name: str | None
    target_topic_name: str | None
    status: str
    message: str | None = None
    existing: bool = False


class TopicRelationshipCandidatePreviewResponse(BaseModel):
    valid_count: int
    warning_count: int
    error_count: int
    items: list[TopicRelationshipCandidatePreview]


class TopicRelationshipCandidateCommitResponse(BaseModel):
    created: int
    skipped_existing: int
    items: list[TopicRelationshipCandidatePreview]
