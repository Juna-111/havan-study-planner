import pytest
from fastapi import HTTPException

from app.services.curriculum_import import parse_bullet_curriculum


def test_parse_havan_explicit_format_with_difficulty():
    content = """Course: [PHY101] Physics
Chapter: Measurement
- Physical quantities [1]
- Units and dimensions [2]
Chapter: Vectors
- Scalars and vectors [2]
- Vector operations [3]
"""
    courses = parse_bullet_curriculum(content)
    assert len(courses) == 1
    assert courses[0].code == "PHY101"
    assert courses[0].name == "Physics"
    assert courses[0].chapters[0].topics[0].difficulty == 1
    assert courses[0].chapters[1].topics[1].difficulty == 3


def test_parse_multiple_courses_with_difficulty():
    content = """Course: Biology
Chapter: Cells
- Cell membrane [1]
Course: Chemistry
Chapter: Matter
- States of matter [2]
"""
    courses = parse_bullet_curriculum(content)
    assert [c.name for c in courses] == ["Biology", "Chemistry"]


def test_parse_legacy_indented_bullets_with_difficulty():
    content = """• [PHY101] Physics
  • Measurement
    • Physical quantities [1]
    • Units and dimensions [2]
"""
    courses = parse_bullet_curriculum(content)
    assert courses[0].chapters[0].topics[1].difficulty == 2


def test_reject_topic_without_difficulty():
    with pytest.raises(HTTPException):
        parse_bullet_curriculum("""Course: Physics
Chapter: Mechanics
- Motion
""")


def test_reject_invalid_difficulty():
    with pytest.raises(HTTPException):
        parse_bullet_curriculum("""Course: Physics
Chapter: Mechanics
- Motion [6]
""")
