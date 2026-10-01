from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.curriculum import Course, Curriculum, Stream, Topic, University
from app.db.models.student import StudentCourse, StudentExam, StudentProfile, StudentTopicProgress
from app.db.session import get_db
from app.schemas.student import (
    ExamCreate, ExamRead, ProgressRead, ProgressUpsert, StudentContext,
    StudentCourseAdd, StudentCourseRead, StudentCreate, StudentRead, StudentUpdate,
)

router = APIRouter(prefix="/api/v1/students", tags=["students"])
DB = Annotated[Session, Depends(get_db)]


def profile_or_404(db: Session, student_id: int) -> StudentProfile:
    profile = db.get(StudentProfile, student_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return profile


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


@router.post("/profiles", response_model=StudentRead, status_code=status.HTTP_201_CREATED)
def create_profile(payload: StudentCreate, db: DB):
    validate_curriculum_context(db, payload.university_id, payload.curriculum_id, payload.stream_id)
    existing = db.scalar(select(StudentProfile).where(StudentProfile.client_key == payload.client_key))
    if existing:
        return existing
    profile = StudentProfile(**payload.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/profiles/by-client/{client_key}", response_model=StudentRead)
def get_profile_by_client(client_key: str, db: DB):
    profile = db.scalar(select(StudentProfile).where(StudentProfile.client_key == client_key))
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return profile


@router.get("/profiles/{student_id}", response_model=StudentRead)
def get_profile(student_id: int, db: DB):
    return profile_or_404(db, student_id)


@router.patch("/profiles/{student_id}", response_model=StudentRead)
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


@router.get("/profiles/{student_id}/context", response_model=StudentContext)
def get_context(student_id: int, db: DB):
    profile = profile_or_404(db, student_id)
    return StudentContext(
        profile=profile,
        courses=list(db.scalars(select(StudentCourse).where(StudentCourse.student_id == student_id)).all()),
        progress=list(db.scalars(select(StudentTopicProgress).where(StudentTopicProgress.student_id == student_id)).all()),
        exams=list(db.scalars(select(StudentExam).where(StudentExam.student_id == student_id).order_by(StudentExam.exam_date)).all()),
    )


@router.get("/profiles/{student_id}/courses", response_model=list[StudentCourseRead])
def list_courses(student_id: int, db: DB):
    profile_or_404(db, student_id)
    return list(db.scalars(select(StudentCourse).where(StudentCourse.student_id == student_id)).all())


@router.post("/profiles/{student_id}/courses", response_model=StudentCourseRead, status_code=201)
def add_course(student_id: int, payload: StudentCourseAdd, db: DB):
    profile = profile_or_404(db, student_id)
    course = db.get(Course, payload.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    stream = db.get(Stream, profile.stream_id)
    if course.stream_id != profile.stream_id:
        raise HTTPException(status_code=400, detail="Course is outside the student's selected stream")
    existing = db.scalar(select(StudentCourse).where(StudentCourse.student_id == student_id, StudentCourse.course_id == payload.course_id))
    if existing:
        existing.status = "ACTIVE"
        existing.confidence = payload.confidence
        db.commit()
        db.refresh(existing)
        return existing
    item = StudentCourse(student_id=student_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/profiles/{student_id}/courses/{course_id}", status_code=204)
def remove_course(student_id: int, course_id: int, db: DB):
    item = db.scalar(select(StudentCourse).where(StudentCourse.student_id == student_id, StudentCourse.course_id == course_id))
    if not item:
        raise HTTPException(status_code=404, detail="Student course not found")
    db.delete(item)
    db.commit()


@router.get("/profiles/{student_id}/progress", response_model=list[ProgressRead])
def list_progress(student_id: int, db: DB):
    profile_or_404(db, student_id)
    return list(db.scalars(select(StudentTopicProgress).where(StudentTopicProgress.student_id == student_id)).all())


@router.put("/profiles/{student_id}/progress/{topic_id}", response_model=ProgressRead)
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
    item.last_studied_at = datetime.now(timezone.utc) if payload.status != "NOT_STARTED" else None
    db.commit()
    db.refresh(item)
    return item


@router.delete("/profiles/{student_id}/progress/{topic_id}", status_code=204)
def reset_progress(student_id: int, topic_id: int, db: DB):
    item = db.scalar(select(StudentTopicProgress).where(StudentTopicProgress.student_id == student_id, StudentTopicProgress.topic_id == topic_id))
    if item:
        db.delete(item)
        db.commit()


@router.get("/profiles/{student_id}/exams", response_model=list[ExamRead])
def list_exams(student_id: int, db: DB):
    profile_or_404(db, student_id)
    return list(db.scalars(select(StudentExam).where(StudentExam.student_id == student_id).order_by(StudentExam.exam_date)).all())


@router.post("/profiles/{student_id}/exams", response_model=ExamRead, status_code=201)
def add_exam(student_id: int, payload: ExamCreate, db: DB):
    profile = profile_or_404(db, student_id)
    course = db.get(Course, payload.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.stream_id != profile.stream_id:
        raise HTTPException(status_code=400, detail="Exam course is outside the student's selected stream")
    item = StudentExam(student_id=student_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/profiles/{student_id}/exams/{exam_id}", status_code=204)
def remove_exam(student_id: int, exam_id: int, db: DB):
    item = db.scalar(select(StudentExam).where(StudentExam.student_id == student_id, StudentExam.id == exam_id))
    if not item:
        raise HTTPException(status_code=404, detail="Exam not found")
    db.delete(item)
    db.commit()
