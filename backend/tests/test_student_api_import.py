def test_student_api_module_imports():
    # This catches missing imports in the student context router before deployment.
    import app.api.student  # noqa: F401


def test_registration_does_not_accept_progress_position_fields() -> None:
    from app.schemas.student import StudentRegistrationCourse

    assert "starting_chapter_id" not in StudentRegistrationCourse.model_fields
    assert "starting_topic_id" not in StudentRegistrationCourse.model_fields


def test_registration_rejects_duplicate_exam_keys() -> None:
    import pytest
    from app.schemas.student import StudentRegistrationCreate

    with pytest.raises(ValueError, match="same exam"):
        StudentRegistrationCreate(
            name="Student",
            university_id=1,
            curriculum_id=1,
            stream_id=1,
            study_days=["mon"],
            courses=[{"course_id": 1}],
            exams=[
                {"course_id": 1, "exam_type": "Final", "exam_date": "2026-10-21"},
                {"course_id": 1, "exam_type": "final", "exam_date": "2026-10-21"},
            ],
        )
