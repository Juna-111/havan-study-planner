from collections.abc import Generator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import Base
from app.db.models.curriculum import Chapter, Course, Stream, Topic, TopicRelationship, Curriculum, University
from app.services.academic_quality import run_academic_quality_checks


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as session:
        yield session
    engine.dispose()


def test_academic_quality_route_is_registered() -> None:
    from app.main import app
    assert "/api/v1/academic-quality" in {route.path for route in app.routes}


def test_quality_detects_missing_content_and_prerequisite_cycle(db_session: Session) -> None:
    university = University(name="Test University", code="TST")
    curriculum = Curriculum(university=university, name="Test Curriculum", version="1")
    stream = Stream(curriculum=curriculum, name="Computer Science", code="CS")
    course = Course(stream=stream, name="Algorithms", code="CS101", status="ACTIVE")
    chapter = Chapter(course=course, name="Graphs", order_index=1, status="ACTIVE")
    topic_a = Topic(chapter=chapter, name="Traversal", order_index=1)
    topic_b = Topic(chapter=chapter, name="Search", order_index=2)
    rel_a = TopicRelationship(source_topic=topic_a, target_topic=topic_b, relationship_type="prerequisite")
    rel_b = TopicRelationship(source_topic=topic_b, target_topic=topic_a, relationship_type="prerequisite")
    db_session.add_all([university, curriculum, stream, course, chapter, topic_a, topic_b, rel_a, rel_b])
    db_session.commit()

    result = run_academic_quality_checks(db_session)
    messages = [item["title"] for item in result["issues"]]

    assert "Prerequisite cycle detected" in messages
    assert result["counts"]["topics"] == 2


def test_quality_reports_active_course_without_chapters(db_session: Session) -> None:
    university = University(name="Test University 2", code="TST2")
    curriculum = Curriculum(university=university, name="Test Curriculum 2", version="1")
    stream = Stream(curriculum=curriculum, name="Physics", code="PHY")
    course = Course(stream=stream, name="Mechanics", code="PHY101", status="ACTIVE")
    db_session.add_all([university, curriculum, stream, course])
    db_session.commit()

    result = run_academic_quality_checks(db_session)
    assert any(item["entity_type"] == "course" and "no active chapter" in item["message"] for item in result["issues"])
