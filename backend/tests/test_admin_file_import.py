import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.deps import current_account
from app.db.models import Chapter, Course, StudentAccount, Topic
from app.db.models.academic_catalog import HavanPromotion
from app.db.models.academic_catalog import Stream, University, UniversityCourseOffering
from app.db.session import Base
from app.db.session import get_db
from app.main import app
from app.services.academic_resolver import resolve_stream_courses
from app.services.admin_file_import import (
    PROMOTION_FILE_MARKER,
    commit_promotion_import,
    commit_university_import,
    parse_promotion_file,
    parse_university_csv,
    preview_promotion_import,
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


def test_promotion_file_preserves_multiple_blank_line_separated_blocks():
    raw = f"""{PROMOTION_FILE_MARKER}

Course_Code: PHY101
Chapter: Measurement
Topic: Units
Platform_Name: Havan Learning Resource
Description: Review the core measurement concepts.
Button_Text: Open resource
URL: https://example.com/measurement
Order_Index: 1
Status: ACTIVE

Course_Code: PHY101
Chapter: Measurement
Platform_Name: Havan Exam Preparation
Description: Practice chapter questions.
Button_Text: Start practice
URL: https://example.com/practice
Order_Index: 2
Status: ACTIVE
"""

    rows = parse_promotion_file(raw.encode())

    assert len(rows) == 2
    assert rows[0].topic_name == "Units"
    assert rows[0].platform_name == "Havan Learning Resource"
    assert rows[0].order_index == 1
    assert rows[1].topic_name is None
    assert rows[1].platform_name == "Havan Exam Preparation"
    assert rows[1].order_index == 2


def test_promotion_preview_and_commit_process_multiple_blocks():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    try:
        with Session(engine) as db:
            course = Course(
                code="PHY101",
                name="Physics",
                academic_scope="FRESHMAN",
                registry_key="FRESHMAN:PHY101",
            )
            db.add(course)
            db.flush()
            chapter = Chapter(course_id=course.id, name="Measurement", order_index=1)
            db.add(chapter)
            db.flush()
            db.add(Topic(chapter_id=chapter.id, name="Units", order_index=1))
            db.commit()

            rows = parse_promotion_file(
                f"""{PROMOTION_FILE_MARKER}

Course_Code: PHY101
Chapter: Measurement
Topic: Units
Platform_Name: Havan Learning Resource
Description: Review key measurement concepts.
Button_Text: Open resource
URL: https://example.com/measurement
Order_Index: 1
Status: ACTIVE

Course_Code: PHY101
Chapter: Measurement
Platform_Name: Havan Exam Preparation
Description: Practice chapter questions.
Button_Text: Start practice
URL: https://example.com/practice
Order_Index: 2
Status: ACTIVE
""".encode()
            )

            assert preview_promotion_import(db, rows) == {"promotions": 2}
            assert commit_promotion_import(db, rows) == {"created": 2, "updated": 0}

            saved = list(db.scalars(select(HavanPromotion).order_by(HavanPromotion.order_index)))
            assert len(saved) == 2
            assert [item.platform_name for item in saved] == [
                "Havan Learning Resource",
                "Havan Exam Preparation",
            ]
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()


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
    raw = b"""university_code,university_name,stream_code,stream_name,semester,course_code,course_name,credit_hours
AAU,Addis Ababa University,NAT,Natural Science,1,PHY101,Physics,3
"""
    rows = parse_university_csv(raw)

    assert len(rows) == 1
    assert rows[0].university_code == "AAU"
    assert rows[0].semester == 1
    assert rows[0].credit_hours == 3


def test_direct_university_stream_csv_import_creates_course_offering():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    try:
        with Session(engine) as db:
            rows = parse_university_csv(
                b"university_code,university_name,stream_code,stream_name,semester,course_code,course_name,credit_hours\n"
                b"AAU,Addis Ababa University,ENG,Engineering,1,PHY101,Physics,3\n"
            )

            assert preview_university_import(rows, db)["streams"] == 1
            result = commit_university_import(db, rows)
            university = db.scalar(select(University).where(University.code == "AAU"))
            stream = db.scalar(select(Stream).where(Stream.university_id == university.id, Stream.code == "ENG"))
            course = db.scalar(select(Course).where(Course.registry_key == "UNIVERSITY:AAU:ENG:PHY101"))
            offering = db.scalar(select(UniversityCourseOffering).where(UniversityCourseOffering.stream_id == stream.id))

            assert result["offerings"] == 1
            assert result["courses"] == 1
            assert offering is not None and offering.semester_number == 1
            assert [item.display_code for item in resolve_stream_courses(db, stream.id)] == ["PHY101"]

            account = StudentAccount(email="learner@example.com", password_hash="test", role="STUDENT")
            db.add(account)
            db.commit()
            db.refresh(account)

            def override_db():
                with Session(engine) as session:
                    yield session

            app.dependency_overrides[get_db] = override_db
            app.dependency_overrides[current_account] = lambda: account
            client = TestClient(app)
            try:
                response = client.post(
                    "/api/v1/students/onboarding",
                    json={
                        "name": "Learner",
                        "university_id": university.id,
                        "stream_id": stream.id,
                        "study_hours_per_day": 2,
                        "study_days": ["mon", "wed"],
                        "courses": [{"course_id": course.id, "confidence": 3}],
                    },
                )
                assert response.status_code == 201, response.text
                assert response.json()["university_id"] == university.id
                assert response.json()["stream_id"] == stream.id
            finally:
                client.close()
                app.dependency_overrides.pop(current_account, None)
                app.dependency_overrides.pop(get_db, None)
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_university_preview_rejects_exact_duplicate_mapping():
    rows = parse_university_csv(
        b"""university_code,university_name,stream_code,stream_name,semester,course_code,course_name,credit_hours
AAU,Addis Ababa University,NAT,Natural Science,1,PHY101,Physics,3
AAU,Addis Ababa University,NAT,Natural Science,1,PHY101,Physics,3
"""
    )

    with pytest.raises(HTTPException, match="duplicate course mapping"):
        preview_university_import(rows)


def test_university_preview_rejects_same_course_in_both_semesters():
    rows = parse_university_csv(
        b"""university_code,university_name,stream_code,stream_name,semester,course_code,course_name,credit_hours
AAU,Addis Ababa University,NAT,Natural Science,1,PHY101,Physics,3
AAU,Addis Ababa University,NAT,Natural Science,2,PHY101,Physics,3
"""
    )

    with pytest.raises(HTTPException, match="both semesters"):
        preview_university_import(rows)


def test_promotion_file_normalizes_valid_https_url():
    raw = f"""{PROMOTION_FILE_MARKER}
course_code: PHY101
chapter: Measurement
platform_name: Havan Academy
button_text: Open
url: https://www.havanacademy.com//physics
"""
    rows = parse_promotion_file(raw.encode())
    assert rows[0].url == "https://www.havanacademy.com/physics"


def test_promotion_file_rejects_invalid_url():
    raw = f"""{PROMOTION_FILE_MARKER}
course_code: PHY101
chapter: Measurement
platform_name: Havan Academy
button_text: Open
url: not-a-url
"""
    with pytest.raises(HTTPException, match="valid http or https URL"):
        parse_promotion_file(raw.encode())
