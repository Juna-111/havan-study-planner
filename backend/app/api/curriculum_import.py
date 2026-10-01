from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models.curriculum import Chapter, Course, Curriculum, Stream, Topic, University
from app.db.session import get_db
from app.schemas.curriculum_import import CurriculumImportPreview, CurriculumImportResult
from app.services.curriculum import get_or_404
from app.services.curriculum_import import parse_bullet_curriculum

router = APIRouter(prefix="/api/v1", tags=["curriculum-import"])
DB = Depends(get_db)


@router.post("/curriculum-import/preview", response_model=CurriculumImportPreview)
async def preview_curriculum_import(
    university_id: int = Query(gt=0),
    curriculum_id: int = Query(gt=0),
    stream_id: int = Query(gt=0),
    file: UploadFile = File(...),
    db: Session = DB,
):
    if not file.filename or not file.filename.lower().endswith((".txt", ".md")):
        raise HTTPException(status_code=415, detail="Upload a .txt or .md bullet-formatted file.")

    university = get_or_404(db, University, university_id)
    curriculum = get_or_404(db, Curriculum, curriculum_id)
    stream = get_or_404(db, Stream, stream_id)

    if curriculum.university_id != university.id:
        raise HTTPException(status_code=422, detail="The curriculum does not belong to the selected university.")
    if stream.curriculum_id != curriculum.id:
        raise HTTPException(status_code=422, detail="The stream does not belong to the selected curriculum.")

    raw = await file.read()
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="The curriculum file must be 2 MB or smaller.")

    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="The curriculum file must be UTF-8 text.") from exc

    parsed = parse_bullet_curriculum(content)
    return {
        "university_id": university.id,
        "curriculum_id": curriculum.id,
        "stream_id": stream.id,
        "courses": [
            {
                "name": course.name,
                "code": course.code,
                "chapters": [
                    {"name": chapter.name, "topics": [{"name": topic.name} for topic in chapter.topics]}
                    for chapter in course.chapters
                ],
            }
            for course in parsed
        ],
    }


@router.post("/curriculum-import/commit", response_model=CurriculumImportResult, status_code=201)
def commit_curriculum_import(payload: CurriculumImportPreview, db: Session = DB):
    university = get_or_404(db, University, payload.university_id)
    curriculum = get_or_404(db, Curriculum, payload.curriculum_id)
    stream = get_or_404(db, Stream, payload.stream_id)

    if curriculum.university_id != university.id:
        raise HTTPException(status_code=422, detail="The curriculum does not belong to the selected university.")
    if stream.curriculum_id != curriculum.id:
        raise HTTPException(status_code=422, detail="The stream does not belong to the selected curriculum.")

    created_courses = created_chapters = created_topics = 0
    try:
        for course_payload in payload.courses:
            course = Course(
                stream_id=stream.id,
                code=course_payload.code,
                name=course_payload.name,
                status="ACTIVE",
            )
            db.add(course)
            db.flush()
            created_courses += 1

            for chapter_index, chapter_payload in enumerate(course_payload.chapters, start=1):
                chapter = Chapter(
                    course_id=course.id,
                    name=chapter_payload.name,
                    order_index=chapter_index,
                    status="ACTIVE",
                )
                db.add(chapter)
                db.flush()
                created_chapters += 1

                for topic_index, topic_payload in enumerate(chapter_payload.topics, start=1):
                    db.add(
                        Topic(
                            chapter_id=chapter.id,
                            name=topic_payload.name,
                            order_index=topic_index,
                            status="ACTIVE",
                        )
                    )
                    created_topics += 1

        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Import was not saved because a course, chapter, or topic already exists.",
        ) from exc

    return {
        "university_id": university.id,
        "curriculum_id": curriculum.id,
        "stream_id": stream.id,
        "courses": payload.courses,
        "created_courses": created_courses,
        "created_chapters": created_chapters,
        "created_topics": created_topics,
    }
