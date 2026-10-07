from app.core.config import API_PREFIX
from app.core.deps import current_account, current_student, require_student_owner
from datetime import datetime, timezone
from uuid import uuid4
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models.curriculum import Chapter, Course, Curriculum, Stream, Topic, University, UniversityCourseMapping
from app.db.models.student import StudentAccount, StudentCourse, StudentExam, StudentProfile, StudentTopicProgress
from app.db.session import get_db
from app.services.academic_resolver import resolve_stream_courses, resolve_student_courses, resolved_course_ids
from app.schemas.student import (
    CourseTopicStatus, ExamCreate, ExamRead, ExamUpdate, ProgressRead, ProgressUpsert, StudentContext,
    StudentCourseAdd, StudentCourseRead, StudentCreate, StudentRead, StudentUpdate, StudentRegistrationCreate,
)

router = APIRouter(prefix=f"{API_PREFIX}/students", tags=["students"], dependencies=[Depends(current_account)])
DB = Annotated[Session, Depends(get_db)]


def profile_or_404(db: Session, student_id: int) -> StudentProfile:
    profile = db.get(StudentProfile, student_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return profile


def course_available_to_stream(db: Session, course_id: int, stream_id: int) -> bool:
    return any(item.course_id == course_id for item in resolve_stream_courses(db, stream_id))


def resolved_student_courses(db: Session, student_id: int) -> list[StudentCourse]:
    effective_course_ids = resolved_course_ids(db, student_id)
    return [
        item
        for item in db.scalars(
            select(StudentCourse).where(StudentCourse.student_id == student_id)
        ).all()
        if item.course_id in effective_course_ids
    ]


def resolved_course_metadata(db: Session, student_id: int) -> dict[int, object]:
    return {
        item.course_id: item
        for item in resolve_student_courses(db, student_id)
    }


def student_course_read_data(db: Session, student_course: StudentCourse, metadata: dict[int, object] | None = None) -> dict:
    effective_metadata = resolved_course_metadata(db, student_course.student_id) if metadata is None else metadata
    effective = effective_metadata.get(student_course.course_id)
    if effective is None:
        raise HTTPException(status_code=400, detail="Student course is no longer available in the active university curriculum")
    return {
        "id": student_course.id,
        "student_id": student_course.student_id,
        "course_id": student_course.course_id,
        "confidence": student_course.confidence,
        "status": student_course.status,
        "course_code": effective.display_code,
        "course_name": effective.display_name,
        "credit_hours": effective.credit_hours,
    }


def validate_curriculum_context(db: Session, university_id: int, curriculum_id: int, stream_id: int) -> None:
    curriculum = db.get(Curriculum, curriculum_id)
    stream = db.get(Stream, stream_id)
    university = db.get(University, university_id)
    if not university or not curriculum or not stream:
        raise HTTPException(status_code=400, detail="University, curriculum, or stream not found")
    if str(university.status).upper() != "ACTIVE":
        raise HTTPException(status_code=400, detail="The selected university is not available for student registration")
    if str(curriculum.status).upper() != "ACTIVE":
        raise HTTPException(status_code=400, detail="The selected curriculum is not available for student registration")
    if str(stream.status).upper() != "ACTIVE":
        raise HTTPException(status_code=400, detail="The selected stream is not available for student registration")
    if curriculum.university_id != university_id:
        raise HTTPException(status_code=400, detail="Curriculum does not belong to the selected university")
    if stream.curriculum_id != curriculum_id:
        raise HTTPException(status_code=400, detail="Stream does not belong to the selected curriculum")


@router.get("/me/profile", response_model=StudentRead)
def get_my_profile(student: Annotated[StudentProfile, Depends(current_student)]):
    return student


@router.get("/me/context", response_model=StudentContext)
def get_my_context(student: Annotated[StudentProfile, Depends(current_student)], db: DB):
    return get_context(student.id, db)


@router.get("/me/courses", response_model=list[StudentCourseRead])
def get_my_courses(student: Annotated[StudentProfile, Depends(current_student)], db: DB):
    return list_courses(student.id, db)


@router.get("/me/catalog")
def get_my_catalog(student: Annotated[StudentProfile, Depends(current_student)], db: DB):
    courses = resolved_student_courses(db, student.id)
    metadata = resolved_course_metadata(db, student.id)
    result = []
    for selected in courses:
        course = db.get(Course, selected.course_id)
        if course is None:
            continue
        chapters = list(db.scalars(
            select(Chapter)
            .where(Chapter.course_id == course.id, func.upper(Chapter.status) == "ACTIVE")
            .order_by(Chapter.order_index, Chapter.id)
        ).all())
        result.append({
            "id": course.id,
            "code": metadata[course.id].display_code,
            "name": metadata[course.id].display_name,
            "chapters": [
                {
                    "id": chapter.id,
                    "name": chapter.name,
                    "order_index": chapter.order_index,
                    "important_points": chapter.important_points,
                    "topics": [
                        {
                            "id": topic.id,
                            "name": topic.name,
                            "difficulty": topic.difficulty,
                            "estimated_study_minutes": topic.estimated_study_minutes,
                            "important_points": topic.important_points,
                            "status": topic.status,
                        }
                        for topic in db.scalars(
                            select(Topic)
                            .where(Topic.chapter_id == chapter.id, func.upper(Topic.status) == "ACTIVE")
                            .order_by(Topic.order_index, Topic.id)
                        ).all()
                    ],
                }
                for chapter in chapters
            ],
        })
    return result


@router.get("/me/progress", response_model=list[ProgressRead])
def get_my_progress(student: Annotated[StudentProfile, Depends(current_student)], db: DB):
    return list_progress(student.id, db)


@router.get("/me/exams", response_model=list[ExamRead])
def get_my_exams(student: Annotated[StudentProfile, Depends(current_student)], db: DB):
    return list_exams(student.id, db)


@router.post("/profiles", response_model=StudentRead, status_code=status.HTTP_201_CREATED)
def create_profile(payload: StudentCreate, db: DB, account: Annotated[StudentAccount, Depends(current_account)]):
    validate_curriculum_context(db, payload.university_id, payload.curriculum_id, payload.stream_id)
    existing = db.scalar(select(StudentProfile).where(StudentProfile.account_id == account.id))
    if existing:
        return existing
    data = payload.model_dump(exclude={"account_id"})
    data["account_id"] = account.id
    data["client_key"] = payload.client_key or f"legacy-{uuid4().hex}"
    profile = StudentProfile(**data)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/profiles/by-client/{client_key}", response_model=StudentRead)
def get_profile_by_client(
    client_key: str,
    db: DB,
    account: Annotated[StudentAccount, Depends(current_account)],
):
    profile = db.scalar(select(StudentProfile).where(StudentProfile.client_key == client_key))
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")
    if profile.account_id != account.id:
        raise HTTPException(status_code=403, detail="You do not own this student profile")
    return profile


@router.get("/profiles/{student_id}", response_model=StudentRead, dependencies=[Depends(require_student_owner)])
def get_profile(student_id: int, db: DB):
    return profile_or_404(db, student_id)


@router.patch("/profiles/{student_id}", response_model=StudentRead, dependencies=[Depends(require_student_owner)])
def update_profile(student_id: int, payload: StudentUpdate, db: DB):
    profile = profile_or_404(db, student_id)
    data = payload.model_dump(exclude_unset=True)
    if {"university_id", "curriculum_id", "stream_id"} & data.keys():
        university_id = data.get("university_id", profile.university_id)
        curriculum_id = data.get("curriculum_id", profile.curriculum_id)
        stream_id = data.get("stream_id", profile.stream_id)
        validate_curriculum_context(db, university_id, curriculum_id, stream_id)
    for key, value in data.items():
        setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/profiles/{student_id}/context", response_model=StudentContext, dependencies=[Depends(require_student_owner)])
def get_context(student_id: int, db: DB):
    profile = profile_or_404(db, student_id)
    student_courses = resolved_student_courses(db, student_id)
    metadata = resolved_course_metadata(db, student_id)
    student_course_reads = [student_course_read_data(db, item, metadata) for item in student_courses]

    course_topic_status = []
    for student_course in student_courses:
        course = db.get(Course, student_course.course_id)
        if not course:
            continue

        chapters = list(db.scalars(
            select(Chapter).where(Chapter.course_id == course.id)
        ).all())
        chapter_ids = [chapter.id for chapter in chapters]

        active_topic_count = 0
        if chapter_ids:
            active_topic_count = len(list(db.scalars(
                select(Topic).where(
                    Topic.chapter_id.in_(chapter_ids),
                    func.upper(Topic.status) == "ACTIVE",
                )
            ).all()))

        course_topic_status.append(CourseTopicStatus(
            course_id=course.id,
            course_code=metadata[course.id].display_code,
            course_name=metadata[course.id].display_name,
            chapter_count=len(chapters),
            active_topic_count=active_topic_count,
        ))

    return StudentContext(
        profile=profile,
        courses=student_course_reads,
        progress=list(db.scalars(select(StudentTopicProgress).where(StudentTopicProgress.student_id == student_id)).all()),
        exams=list(db.scalars(select(StudentExam).where(StudentExam.student_id == student_id).order_by(StudentExam.exam_date)).all()),
        course_topic_status=course_topic_status,
    )


@router.get("/profiles/{student_id}/courses", response_model=list[StudentCourseRead], dependencies=[Depends(require_student_owner)])
def list_courses(student_id: int, db: DB):
    profile_or_404(db, student_id)
    metadata = resolved_course_metadata(db, student_id)
    return [student_course_read_data(db, item, metadata) for item in resolved_student_courses(db, student_id)]


def _apply_course_selection(db: Session, profile: StudentProfile, payload: StudentCourseAdd) -> StudentCourse:
    course = db.get(Course, payload.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if str(course.status).upper() != "ACTIVE":
        raise HTTPException(status_code=400, detail="The selected course is not available")
    if not course_available_to_stream(db, course.id, profile.stream_id):
        raise HTTPException(status_code=400, detail="Course is outside the student's selected stream")

    existing = db.scalar(select(StudentCourse).where(
        StudentCourse.student_id == profile.id,
        StudentCourse.course_id == payload.course_id,
    ))
    if existing:
        existing.status = "ACTIVE"
        existing.confidence = payload.confidence
        existing_progress = db.scalar(select(StudentTopicProgress.id).where(
            StudentTopicProgress.student_id == profile.id,
            StudentTopicProgress.topic_id.in_(
                select(Topic.id).join(Chapter, Chapter.id == Topic.chapter_id).where(Chapter.course_id == course.id)
            ),
        ).limit(1))
        if existing_progress is not None or (
            payload.starting_chapter_id is None and payload.starting_topic_id is None
        ):
            return existing
        item = existing
    else:
        item = StudentCourse(student_id=profile.id, course_id=payload.course_id, confidence=payload.confidence)
        db.add(item)
        db.flush()

    if payload.starting_chapter_id is not None or payload.starting_topic_id is not None:
        chapters = list(db.scalars(select(Chapter).where(
            Chapter.course_id == course.id,
            func.upper(Chapter.status) == "ACTIVE",
        ).order_by(Chapter.order_index, Chapter.id)).all())
        chapter_by_id = {chapter.id: chapter for chapter in chapters}

        if payload.starting_chapter_id is not None and payload.starting_chapter_id not in chapter_by_id:
            raise HTTPException(status_code=400, detail="Starting chapter does not belong to the selected course")

        selected_topic = None
        if payload.starting_topic_id is not None:
            selected_topic = db.get(Topic, payload.starting_topic_id)
            if selected_topic is None or str(selected_topic.status).upper() != "ACTIVE":
                raise HTTPException(status_code=400, detail="Starting topic is not available")
            if selected_topic.chapter_id not in chapter_by_id:
                raise HTTPException(status_code=400, detail="Starting topic does not belong to the selected course")
            if payload.starting_chapter_id is not None and selected_topic.chapter_id != payload.starting_chapter_id:
                raise HTTPException(status_code=400, detail="Starting topic must belong to the selected starting chapter")

        target_chapter_id = payload.starting_chapter_id or selected_topic.chapter_id
        target_chapter = chapter_by_id[target_chapter_id]
        topic_rows = list(db.scalars(select(Topic).where(
            Topic.chapter_id.in_([chapter.id for chapter in chapters]),
            func.upper(Topic.status) == "ACTIVE",
        ).order_by(Topic.chapter_id, Topic.order_index, Topic.id)).all())
        chapter_position = {chapter.id: index for index, chapter in enumerate(chapters)}
        selected_topic_position = None if selected_topic is None else (
            chapter_position[selected_topic.chapter_id], selected_topic.order_index, selected_topic.id
        )

        for topic in topic_rows:
            topic_position = (chapter_position[topic.chapter_id], topic.order_index, topic.id)
            if topic_position < (chapter_position[target_chapter.id], -1, -1) or (
                selected_topic_position is not None and topic_position < selected_topic_position
            ):
                progress = db.scalar(select(StudentTopicProgress).where(
                    StudentTopicProgress.student_id == profile.id,
                    StudentTopicProgress.topic_id == topic.id,
                ))
                if progress is None:
                    db.add(StudentTopicProgress(
                        student_id=profile.id,
                        topic_id=topic.id,
                        status="COMPLETED",
                        confidence=payload.confidence,
                        completed_minutes=topic.estimated_study_minutes,
                        study_sessions=1,
                    ))
                elif progress.status != "COMPLETED":
                    progress.status = "COMPLETED"
                    progress.confidence = payload.confidence
                    progress.completed_minutes = max(progress.completed_minutes, topic.estimated_study_minutes)
                    progress.study_sessions = max(progress.study_sessions, 1)

        if selected_topic is not None:
            progress = db.scalar(select(StudentTopicProgress).where(
                StudentTopicProgress.student_id == profile.id,
                StudentTopicProgress.topic_id == selected_topic.id,
            ))
            if progress is None:
                db.add(StudentTopicProgress(
                    student_id=profile.id,
                    topic_id=selected_topic.id,
                    status="IN_PROGRESS",
                    confidence=payload.confidence,
                    completed_minutes=0,
                    study_sessions=0,
                ))
            elif progress.status != "COMPLETED":
                progress.status = "IN_PROGRESS"
                progress.confidence = payload.confidence

    return item


@router.post("/profiles/{student_id}/courses", response_model=StudentCourseRead, status_code=201, dependencies=[Depends(require_student_owner)])
def add_course(student_id: int, payload: StudentCourseAdd, db: DB):
    profile = profile_or_404(db, student_id)
    item = _apply_course_selection(db, profile, payload)
    db.commit()
    db.refresh(item)
    return student_course_read_data(db, item)


@router.post("/onboarding", response_model=StudentRead, status_code=status.HTTP_201_CREATED)
def complete_onboarding(
    payload: StudentRegistrationCreate,
    db: DB,
    account: Annotated[StudentAccount, Depends(current_account)],
):
    if len({item.course_id for item in payload.courses}) != len(payload.courses):
        raise HTTPException(status_code=400, detail="Each course can only be selected once")

    validate_curriculum_context(db, payload.university_id, payload.curriculum_id, payload.stream_id)

    existing = db.scalar(select(StudentProfile).where(StudentProfile.account_id == account.id))
    if existing is None:
        profile = StudentProfile(
            account_id=account.id,
            client_key=payload.client_key or f"legacy-{uuid4().hex}",
            name=payload.name,
            university_id=payload.university_id,
            curriculum_id=payload.curriculum_id,
            stream_id=payload.stream_id,
            study_hours_per_day=payload.study_hours_per_day,
            study_days=payload.study_days,
        )
        db.add(profile)
        db.flush()
    else:
        profile = existing
        profile.name = payload.name
        profile.university_id = payload.university_id
        profile.curriculum_id = payload.curriculum_id
        profile.stream_id = payload.stream_id
        profile.study_hours_per_day = payload.study_hours_per_day
        profile.study_days = payload.study_days

    try:
        selected_course_ids = {course.course_id for course in payload.courses}
        existing_courses = list(db.scalars(
            select(StudentCourse).where(StudentCourse.student_id == profile.id)
        ).all())
        for existing_course in existing_courses:
            if existing_course.course_id not in selected_course_ids:
                db.delete(existing_course)

        for course in payload.courses:
            _apply_course_selection(db, profile, StudentCourseAdd(
                course_id=course.course_id,
                confidence=course.confidence,
                starting_chapter_id=course.starting_chapter_id,
                starting_topic_id=course.starting_topic_id,
            ))
        db.commit()
        db.refresh(profile)
        return profile
    except Exception:
        db.rollback()
        raise


@router.delete("/profiles/{student_id}/courses/{course_id}", status_code=204, dependencies=[Depends(require_student_owner)])
def remove_course(student_id: int, course_id: int, db: DB):
    item = db.scalar(select(StudentCourse).where(StudentCourse.student_id == student_id, StudentCourse.course_id == course_id))
    if not item:
        raise HTTPException(status_code=404, detail="Student course not found")
    db.delete(item)
    db.commit()


@router.get("/profiles/{student_id}/progress", response_model=list[ProgressRead], dependencies=[Depends(require_student_owner)])
def list_progress(student_id: int, db: DB):
    profile_or_404(db, student_id)
    rows = db.execute(
        select(StudentTopicProgress, Topic.name, Course.name)
        .join(Topic, Topic.id == StudentTopicProgress.topic_id)
        .join(Chapter, Chapter.id == Topic.chapter_id)
        .join(Course, Course.id == Chapter.course_id)
        .where(StudentTopicProgress.student_id == student_id)
    ).all()
    return [
        {
            "id": progress.id,
            "student_id": progress.student_id,
            "topic_id": progress.topic_id,
            "status": progress.status,
            "confidence": progress.confidence,
            "notes": progress.notes,
            "last_studied_at": progress.last_studied_at,
            "completed_minutes": progress.completed_minutes,
            "study_sessions": progress.study_sessions,
            "topic_name": topic_name,
            "course_name": course_name,
        }
        for progress, topic_name, course_name in rows
    ]


@router.put("/profiles/{student_id}/progress/{topic_id}", response_model=ProgressRead, dependencies=[Depends(require_student_owner)])
def upsert_progress(student_id: int, topic_id: int, payload: ProgressUpsert, db: DB):
    profile_or_404(db, student_id)
    if not db.get(Topic, topic_id):
        raise HTTPException(status_code=404, detail="Topic not found")
    item = db.scalar(select(StudentTopicProgress).where(StudentTopicProgress.student_id == student_id, StudentTopicProgress.topic_id == topic_id))
    if item is None:
        item = StudentTopicProgress(student_id=student_id, topic_id=topic_id)
        db.add(item)
    item.status = payload.status
    item.confidence = payload.confidence
    item.notes = payload.notes

    if payload.status == "NOT_STARTED":
        item.completed_minutes = 0
        item.study_sessions = 0
        item.last_studied_at = None
    elif payload.status == "COMPLETED":
        topic = db.get(Topic, topic_id)
        item.completed_minutes = max(item.completed_minutes, topic.estimated_study_minutes if topic else 0)
        item.study_sessions = max(item.study_sessions, 1)
        item.last_studied_at = datetime.now(timezone.utc)
    else:
        item.last_studied_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/profiles/{student_id}/progress/{topic_id}", status_code=204, dependencies=[Depends(require_student_owner)])
def reset_progress(student_id: int, topic_id: int, db: DB):
    item = db.scalar(select(StudentTopicProgress).where(StudentTopicProgress.student_id == student_id, StudentTopicProgress.topic_id == topic_id))
    if item:
        db.delete(item)
        db.commit()


def _validate_exam_scope(db: Session, profile: StudentProfile, course_id: int, topic_ids: list[int]) -> None:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Exam course not found")
    if course.id not in resolved_course_ids(db, profile.id):
        raise HTTPException(status_code=400, detail="Exam course is not part of the student's active university curriculum")
    if not topic_ids:
        return
    unique_ids = set(topic_ids)
    if len(unique_ids) != len(topic_ids):
        raise HTTPException(status_code=400, detail="Exam scope contains duplicate topics")
    valid_count = db.scalar(
        select(func.count(Topic.id))
        .join(Chapter, Chapter.id == Topic.chapter_id)
        .where(
            Topic.id.in_(unique_ids),
            Chapter.course_id == course_id,
            func.upper(Topic.status) == "ACTIVE",
        )
    ) or 0
    if valid_count != len(unique_ids):
        raise HTTPException(status_code=400, detail="Every exam-scope topic must belong to the selected course and be active")


@router.get("/profiles/{student_id}/exams", response_model=list[ExamRead], dependencies=[Depends(require_student_owner)])
def list_exams(student_id: int, db: DB):
    profile_or_404(db, student_id)
    return list(db.scalars(select(StudentExam).where(StudentExam.student_id == student_id).order_by(StudentExam.exam_date)).all())


@router.post("/profiles/{student_id}/exams", response_model=ExamRead, status_code=201, dependencies=[Depends(require_student_owner)])
def add_exam(student_id: int, payload: ExamCreate, db: DB):
    profile = profile_or_404(db, student_id)
    _validate_exam_scope(db, profile, payload.course_id, payload.selected_topic_ids)
    item = StudentExam(student_id=student_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/profiles/{student_id}/exams/{exam_id}", response_model=ExamRead, dependencies=[Depends(require_student_owner)])
def update_exam(student_id: int, exam_id: int, payload: ExamUpdate, db: DB):
    profile = profile_or_404(db, student_id)
    item = db.scalar(
        select(StudentExam).where(
            StudentExam.student_id == student_id,
            StudentExam.id == exam_id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Exam not found")

    data = payload.model_dump(exclude_unset=True)
    course_id = data.get("course_id", item.course_id)
    topic_ids = data.get("selected_topic_ids", item.selected_topic_ids)
    _validate_exam_scope(db, profile, course_id, topic_ids)
    for key, value in data.items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/profiles/{student_id}/exams/{exam_id}", status_code=204, dependencies=[Depends(require_student_owner)])
def remove_exam(student_id: int, exam_id: int, db: DB):
    item = db.scalar(select(StudentExam).where(StudentExam.student_id == student_id, StudentExam.id == exam_id))
    if not item:
        raise HTTPException(status_code=404, detail="Exam not found")
    db.delete(item)
    db.commit()
