import pytest
from fastapi import HTTPException

from app.services.freshman_registry_parser import parse_bullet_curriculum


def test_parse_canonical_havan_format_with_difficulty():
    courses = parse_bullet_curriculum(
        """Course: [PHY101] Physics
Chapter: Measurement
- Physical quantities [1]
- Units and dimensions [2]
Chapter: Vectors
- Scalars and vectors [2]
- Vector operations [3]
"""
    )
    assert len(courses) == 1
    assert courses[0].code == "PHY101"
    assert courses[0].name == "Physics"
    assert courses[0].chapters[1].topics[1].difficulty == 3


def test_parse_multiple_canonical_courses():
    courses = parse_bullet_curriculum(
        """Course: Biology
Chapter: Cells
- Cell membrane [1]
Course: Chemistry
Chapter: Matter
- States of matter [2]
"""
    )
    assert [course.name for course in courses] == ["Biology", "Chemistry"]


def test_reject_topic_without_difficulty():
    with pytest.raises(HTTPException):
        parse_bullet_curriculum(
            """Course: Physics
Chapter: Mechanics
- Motion
"""
        )


def test_reject_invalid_difficulty():
    with pytest.raises(HTTPException):
        parse_bullet_curriculum(
            """Course: Physics
Chapter: Mechanics
- Motion [6]
"""
        )


def test_reject_legacy_indented_structure():
    with pytest.raises(HTTPException):
        parse_bullet_curriculum(
            """• [PHY101] Physics
  • Measurement
    • Physical quantities [3]
"""
        )
