from app.services.curriculum_import import parse_bullet_curriculum


def test_parse_three_level_bullets():
    content = """• [PHY101] Physics
  • Measurement
    • Physical quantities
    • Units and dimensions
  • Vectors
    • Scalars and vectors
"""
    courses = parse_bullet_curriculum(content)
    assert len(courses) == 1
    assert courses[0].code == "PHY101"
    assert courses[0].name == "Physics"
    assert len(courses[0].chapters) == 2
    assert len(courses[0].chapters[0].topics) == 2


def test_parse_multiple_courses():
    content = """- Biology
  - Cells
    - Cell membrane
- Chemistry
  - Matter
    - States of matter
"""
    courses = parse_bullet_curriculum(content)
    assert [c.name for c in courses] == ["Biology", "Chemistry"]


def test_reject_non_bullet_line():
    import pytest
    from fastapi import HTTPException

    with pytest.raises(HTTPException):
        parse_bullet_curriculum("Physics\n  • Measurement\n    • Units")
