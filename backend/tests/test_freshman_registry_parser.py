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
    assert courses[0].code == "PHY101"
    assert courses[0].name == "Physics"
    assert courses[0].chapters[1].topics[1].difficulty == 3


def test_parse_course_code_with_spaces_and_bullet_symbol():
    courses = parse_bullet_curriculum(
        """Course: [Math 1011] Applied Mathematics I
Chapter: Foundations
• Sets and notation [3]
"""
    )
    assert courses[0].code == "Math 1011"
    assert courses[0].name == "Applied Mathematics I"


def test_reject_course_without_explicit_identity():
    with pytest.raises(HTTPException, match="canonical"):
        parse_bullet_curriculum(
            """Course: Physics
Chapter: Mechanics
- Motion [2]
"""
        )


def test_reject_invalid_course_code():
    with pytest.raises(HTTPException, match="course code"):
        parse_bullet_curriculum(
            """Course: [PHY/101] Physics
Chapter: Mechanics
- Motion [2]
"""
        )


def test_reject_duplicate_course_code():
    with pytest.raises(HTTPException, match="Duplicate course code"):
        parse_bullet_curriculum(
            """Course: [PHY101] Physics
Chapter: Mechanics
- Motion [2]
Course: [phy101] Physics II
Chapter: Waves
- Frequency [2]
"""
        )


def test_reject_duplicate_chapter():
    with pytest.raises(HTTPException, match="duplicate chapter"):
        parse_bullet_curriculum(
            """Course: [PHY101] Physics
Chapter: Mechanics
- Motion [2]
Chapter: mechanics
- Force [2]
"""
        )


def test_reject_duplicate_topic():
    with pytest.raises(HTTPException, match="duplicate topic"):
        parse_bullet_curriculum(
            """Course: [PHY101] Physics
Chapter: Mechanics
- Motion [2]
- motion [3]
"""
        )


def test_reject_topic_without_difficulty():
    with pytest.raises(HTTPException):
        parse_bullet_curriculum(
            """Course: [PHY101] Physics
Chapter: Mechanics
- Motion
"""
        )


def test_reject_invalid_difficulty():
    with pytest.raises(HTTPException):
        parse_bullet_curriculum(
            """Course: [PHY101] Physics
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
