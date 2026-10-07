import pytest
from fastapi import HTTPException

from app.services.admin_file_import import (
    PROMOTION_FILE_MARKER,
    parse_promotion_file,
    parse_university_csv,
    preview_university_import,
)


def test_promotion_file_requires_canonical_marker():
    with pytest.raises(HTTPException, match="HAVAN_PROMOTION_V1"):
        parse_promotion_file(b"Course_Code: PHY101")


def test_promotion_file_parses_optional_topic_and_defaults():
    raw = f"""{PROMOTION_FILE_MARKER}
course_code: PHY101
chapter: Measurement
topic: Units
platform_name: Havan Academy
button_text: Watch course
url: https://example.com/physics
"""
    rows = parse_promotion_file(raw.encode())

    assert len(rows) == 1
    assert rows[0].course_code == "PHY101"
    assert rows[0].chapter_name == "Measurement"
    assert rows[0].topic_name == "Units"
    assert rows[0].order_index == 1
    assert rows[0].status == "ACTIVE"


def test_promotion_file_rejects_missing_required_field():
    raw = f"""{PROMOTION_FILE_MARKER}
course_code: PHY101
chapter: Measurement
platform_name: Havan Academy
url: https://example.com/physics
"""
    with pytest.raises(HTTPException, match="button_text"):
        parse_promotion_file(raw.encode())


def test_promotion_file_rejects_invalid_status():
    raw = f"""{PROMOTION_FILE_MARKER}
course_code: PHY101
chapter: Measurement
platform_name: Havan Academy
button_text: Open
url: https://example.com/physics
status: PUBLISHED
"""
    with pytest.raises(HTTPException, match="status"):
        parse_promotion_file(raw.encode())


def test_university_csv_parses_utf8_and_normalizes_semester():
    raw = b"""university_code,university_name,curriculum,curriculum_version,academic_year,stream_code,stream_name,semester,course_code,course_name,credit_hours
AAU,Addis Ababa University,Harmonized Freshman,2026,2026/27,NAT,Natural Science,1,PHY101,Physics,3
"""
    rows = parse_university_csv(raw)

    assert len(rows) == 1
    assert rows[0].university_code == "AAU"
    assert rows[0].semester == 1
    assert rows[0].credit_hours == 3


def test_university_preview_rejects_exact_duplicate_mapping():
    rows = parse_university_csv(
        b"""university_code,university_name,curriculum,curriculum_version,academic_year,stream_code,stream_name,semester,course_code,course_name,credit_hours
AAU,Addis Ababa University,Harmonized Freshman,2026,2026/27,NAT,Natural Science,1,PHY101,Physics,3
AAU,Addis Ababa University,Harmonized Freshman,2026,2026/27,NAT,Natural Science,1,PHY101,Physics,3
"""
    )

    with pytest.raises(HTTPException, match="duplicate course mapping"):
        preview_university_import(rows)


def test_university_preview_rejects_same_course_in_both_semesters():
    rows = parse_university_csv(
        b"""university_code,university_name,curriculum,curriculum_version,academic_year,stream_code,stream_name,semester,course_code,course_name,credit_hours
AAU,Addis Ababa University,Harmonized Freshman,2026,2026/27,NAT,Natural Science,1,PHY101,Physics,3
AAU,Addis Ababa University,Harmonized Freshman,2026,2026/27,NAT,Natural Science,2,PHY101,Physics,3
"""
    )

    with pytest.raises(HTTPException, match="both semesters"):
        preview_university_import(rows)


def test_promotion_file_normalizes_valid_https_url():
    raw = f"""{PROMOTION_FILE_MARKER
course_code: PHY101
chapter: Measurement
platform_name: Havan Academy
button_text: Open
url: https://www.havanacademy.com//physics
"""
    rows = parse_promotion_file(raw.encode())
    assert rows[0].url == "https://www.havanacademy.com/physics"


def test_promotion_file_rejects_invalid_url():
    raw = f"""PROMOTION_FILE_MARKER
course_code: PHY101
chapter: Measurement
platform_name: Havan Academy
button_text: Open
url: not-a-url
"""
    with pytest.raises(HTTPException, match="valid http or https URL"):
        parse_promotion_file(raw.encode())
