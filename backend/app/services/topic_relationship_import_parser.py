from __future__ import annotations

from dataclasses import dataclass
import re

from fastapi import HTTPException


HEADER_RE = re.compile(r"^\s*Relationship:\s*(.+?)\s*$", re.IGNORECASE)
REF_RE = re.compile(r"^([A-Za-z0-9_.-]+):(\d+)$")
ALLOWED_TYPES = {"prerequisite", "conceptual", "cross_course", "related", "revision"}


@dataclass(frozen=True)
class ParsedRelationship:
    source_ref: str
    target_ref: str
    relationship_type: str
    strength: float
    notes: str | None
    line_number: int


def _parse_ref(value: str, line_number: int, label: str) -> str:
    value = value.strip()
    match = REF_RE.fullmatch(value)
    if not match:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Line {line_number}: invalid {label} reference '{value}'. "
                "Use CourseCode:TopicId, for example PHY101:42."
            ),
        )
    return f"{match.group(1).upper()}:{int(match.group(2))}"


def parse_topic_relationships(content: str) -> list[ParsedRelationship]:
    parsed: list[ParsedRelationship] = []

    for line_number, raw_line in enumerate(content.splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        match = HEADER_RE.match(line)
        if not match:
            raise HTTPException(
                status_code=422,
                detail=f"Line {line_number}: expected 'Relationship: source -> target | type | strength | notes'.",
            )

        parts = [part.strip() for part in match.group(1).split("|")]
        if len(parts) < 3 or len(parts) > 4:
            raise HTTPException(
                status_code=422,
                detail=f"Line {line_number}: expected 3 or 4 fields after Relationship:.",
            )

        endpoints = parts[0].split("->")
        if len(endpoints) != 2:
            raise HTTPException(
                status_code=422,
                detail=f"Line {line_number}: relationship must contain exactly one '->'.",
            )

        source_ref = _parse_ref(endpoints[0], line_number, "source topic")
        target_ref = _parse_ref(endpoints[1], line_number, "target topic")
        if source_ref == target_ref:
            raise HTTPException(status_code=422, detail=f"Line {line_number}: a topic cannot relate to itself.")

        relationship_type = parts[1].lower()
        if relationship_type not in ALLOWED_TYPES:
            allowed = ", ".join(sorted(ALLOWED_TYPES))
            raise HTTPException(
                status_code=422,
                detail=f"Line {line_number}: invalid relationship type '{parts[1]}'. Allowed: {allowed}.",
            )

        try:
            strength = float(parts[2])
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Line {line_number}: strength must be a number from 0 to 1.") from exc
        if not 0 <= strength <= 1:
            raise HTTPException(status_code=422, detail=f"Line {line_number}: strength must be between 0 and 1.")

        notes = parts[3] if len(parts) == 4 and parts[3] else None
        parsed.append(
            ParsedRelationship(
                source_ref=source_ref,
                target_ref=target_ref,
                relationship_type=relationship_type,
                strength=strength,
                notes=notes,
                line_number=line_number,
            )
        )

    if not parsed:
        raise HTTPException(status_code=422, detail="The uploaded relationship file contains no relationships.")

    seen: set[tuple[str, str, str]] = set()
    for item in parsed:
        key = (item.source_ref, item.target_ref, item.relationship_type)
        if key in seen:
            raise HTTPException(
                status_code=422,
                detail=f"Line {item.line_number}: duplicate relationship appears earlier in this file.",
            )
        seen.add(key)

    return parsed
