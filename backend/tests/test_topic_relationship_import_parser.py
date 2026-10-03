import pytest
from fastapi import HTTPException

from app.services.topic_relationship_import_parser import parse_topic_relationships


def test_parse_relationship():
    items = parse_topic_relationships(
        "Relationship: PHY101:42 -> MAT101:17 | prerequisite | 0.9 | Algebra foundation"
    )
    assert items[0].source_ref == "PHY101:42"
    assert items[0].target_ref == "MAT101:17"
    assert items[0].relationship_type == "prerequisite"
    assert items[0].strength == 0.9


def test_reject_missing_stable_reference():
    with pytest.raises(HTTPException, match="Line 1"):
        parse_topic_relationships("Relationship: Physics:Measurement -> MAT101:17 | prerequisite | 1")


def test_reject_invalid_type_with_line_number():
    with pytest.raises(HTTPException, match="Line 2"):
        parse_topic_relationships(
            "# Havan topic relationships\n"
            "Relationship: PHY101:42 -> MAT101:17 | depends | 1"
        )


def test_reject_invalid_strength():
    with pytest.raises(HTTPException, match="Line 1"):
        parse_topic_relationships("Relationship: PHY101:42 -> MAT101:17 | prerequisite | 2")


def test_reject_duplicate_relationships():
    with pytest.raises(HTTPException, match="duplicate"):
        parse_topic_relationships(
            "Relationship: PHY101:42 -> MAT101:17 | prerequisite | 1\n"
            "Relationship: PHY101:42 -> MAT101:17 | prerequisite | 0.8"
        )


def test_accept_comments_and_blank_lines():
    items = parse_topic_relationships(
        "# Havan relationships\n\n"
        "Relationship: PHY101:42 -> MAT101:17 | related | 0.5"
    )
    assert len(items) == 1
