from app.core.config import API_PREFIX
from app.core.deps import current_account, require_student_owner
from datetime import datetime, timezone
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
    StudentCourseAdd, StudentCourseRead, StudentCreate, StudentRead, StudentUpdate,
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
    if curriculum.university_id != university_id:
        raise HTTPException(status_code=400, detail="Curriculum does not belong to the selected university")
    if stream.curriculum_id != curriculum_id:
        raise HTTPException(status_code=400, detail="Stream does not belong to the selected curriculum")


@router.post("/profiles", response_model=StudentRead, status_code=status.HTTP_201_CREATED)\ndef
def create_profile(payload: StudentCreate, db: DB, account: Annotated[StudentAccount, Depends(current_account)]):
    validate_curriculum_context(db, payload.university_id, payload.curriculum_id, payload.stream_id)
    existing = db.scalar(select(StudentProfile).where(StudentProfile.client_key == payload.client_key))
    if existing:
        return existing
    data = payload.model_dump(exclude={"account_id"})
    data["account_id"] = account.id
    profile = StudentProfile(**data)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/profiles/by-client/{client_key}", response_model=StudentRead)
def get_profile_by_client(client_key: str, db: DB, account: Annotated[StudentAccount, Depends(current_account)]):
    profile = db.scalar(select(StudentProfile).where(StudentProfile.client_key == client_key))
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")
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


@router.post("/profiles/{student_id}/courses", response_model=StudentCourseRead, status_code=201, dependencies=[Depends(require_student_owner)])
def add_course(student_id: int, payload: StudentCourseAdd, db: DB):
    profile = profile_or_404(db, student_id)
    course = db.get(Course, payload.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not course_available_to_stream(db, course.id, profile.stream_id):
        raise HTTPException(status_code=400, detail="Course is outside the student's selected stream")
    existing = db.scalar(select(StudentCourse).where(StudentCourse.student_id == student_id, StudentCourse.course_id == payload.course_id))
    if existing:
        existing.status = "ACTIVE"
        existing.confidence = payload.confidence
        db.commit()
        db.refresh(existing)
        return student_course_read_data(db, existing)

    item = StudentCourse(
        student_id=student_id,
        course_id=payload.course_id,
        confidence=payload.confidence,
    )
    db.add(item)
    db.flush()

    # A selected starting position means the student is telling Havan where
    # they are in the course. Topics before that position are treated as
    # already covered; the selected topic remains the first active target.
    if payload.starting_chapter_id is not None or payload.starting_topic_id is not None:
        chapters = list(db.scalars(
            select(Chapter)
            .where(Chapter.course_id == course.id)
            .order_by(Chapter.order_index, Chapter.id)
        ).all())
        chapter_by_id = {chapter.id: chapter for chapter in chapters}

        if payload.starting_chapter_id is not None and payload.starting_chapter_id not in chapter_by_id:
            raise HTTPException(status_code=400, detail="Starting chapter does not belong to the selected course")

        selected_topic = None
        if payload.starting_topic_id is not None:
            selected_topic = db.get(Topic, payload.starting_topic_id)
            if selected_topic is None:
                raise HTTPException(status_code=400, detail="Starting topic not found")
            if selected_topic.chapter_id not in chapter_by_id:
                raise HTTPException(status_code=400, detail="Starting topic does not belong to the selected course")
            if payload.starting_chapter_id is not None and selected_topic.chapter_id != payload.starting_chapter_id:
                raise HTTPException(status_code=400, detail="Starting topic must belong to the selected starting chapter")

        target_chapter_id = payload.starting_chapter_id or selected_topic.chapter_id
        target_chapter = chapter_by_id[target_chapter_id]
        topic_rows = list(db.scalars(
            select(Topic)
            .where(Topic.chapter_id.in_([chapter.id for chapter in chapters]))
            .order_by(Topic.chapter_id, Topic.order_index, Topic.id)
        ).all())
        chapter_position = {chapter.id: index for index, chapter in enumerate(chapters)}
        selected_topic_position = None
        if selected_topic is not None:
            selected_topic_position = (chapter_position[selected_topic.chapter_id], selected_topic.order_index, selected_topic.id)

        for topic in topic_rows:
            topic_position = (chapter_position[topic.chapter_id], topic.order_index, topic.id)
            if topic_position < (chapter_position[target_chapter.id], -1, -1) or (
                selected_topic_position is not None and topic_position < selected_topic_position
            ):
                db.add(StudentTopicProgress(
                    student_id=student_id,
                    topic_id=topic.id,
                    status="COMPLETED",
                    confidence=payload.confidence,
                    completed_minutes=topic.estimated_study_minutes,
                    study_sessions=1,
                ))

        if selected_topic is not None:
            db.add(StudentTopicProgress(
                student_id=student_id,
                topic_id=selected_topic.id,
                status="IN_PROGRESS",
                confidence=payload.confidence,
                completed_minutes=0,
                study_sessions=0,
            ))

    db.commit()
    db.refresh(item)
    return student_course_read_data(db, item)


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
    return list(db.scalars(select(StudentTopicProgress).where(StudentTopicProgress.student_id == student_id)).all())


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


@router.get("/profiles/{student_id}/exams", response_model=list[ExamRead], dependencies=[Depends(require_student_owner)])
def list_exams(student_id: int, db: DB):
    profile_or_404(db, student_id)
    return list(db.scalars(select(StudentExam).where(StudentExam.student_id == student_id).order_by(StudentExam.exam_date)).all())


@router.post("/profiles/{student_id}/exams", response_model=ExamRead, status_code=201, dependencies=[Depends(require_student_owner)])
def add_exam(student_id: int, payload: ExamCreate, db: DB):
    profile = profile_or_404(db, student_id)
    course = db.get(Course, payload.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not course_available_to_stream(db, course.id, profile.stream_id):
        raise HTTPException(status_code=400, detail="Exam course is outside the student's selected stream")
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
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Exam course not found")
    if not course_available_to_stream(db, course.id, profile.stream_id):
        raise HTTPException(status_code=400, detail="Exam course is outside the student's selected stream")

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
