from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models.curriculum import Chapter, Course, Curriculum, Stream, Topic, University
from app.db.session import get_db
from app.schemas.curriculum_import import CurriculumImportPreview, CurriculumImportResult, FullStructurePreview, FullStructureResult
from app.services.curriculum import get_or_404
from app.services.curriculum_import import parse_bullet_curriculum, parse_full_structure

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
        raise HTTPException(status_code=415, detail="Upload a .txt or .md curriculum file.")

    university = get_or_404(db, University, university_id)
    curriculum = get_or_404(db, Curriculum, curriculum_id)
    stream = get_or_404(db, Stream, stream_id)

    if curriculum.university_id != university.id:
        raise HTTPException(status_code=422, detail="The curriculum does not belong to the selected university.")
    if stream.curriculum_id != curriculum.id:
        raise HTTPException(status_code=422, detail="The stream does not belong to the selected curriculum.")

    raw = await file.read()
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="The curriculum file must be 5 MB or smaller.")

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
                    {
                        "name": chapter.name,
                        "topics": [
                            {"name": topic.name, "difficulty": topic.difficulty}
                            for topic in chapter.topics
                        ],
                    }
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
                            difficulty=topic_payload.difficulty,
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


@router.post("/curriculum-import/bootstrap-demo", status_code=201)
def bootstrap_demo_academic_structure(db: Session = DB):
    """Create a small linked academic structure for Phase 3 testing when the database is empty."""
    if db.query(University).count() > 0:
        return {"created": False, "message": "Academic structure already exists."}

    demo = [
        ("Havan Demo University", "HAVAN-DEMO-1"),
        ("Havan Science University", "HAVAN-DEMO-2"),
        ("Havan Technology University", "HAVAN-DEMO-3"),
    ]
    created = []
    try:
        for index, (name, code) in enumerate(demo, start=1):
            university = University(name=name, code=code, description="Phase 3 testing data.", status="ACTIVE")
            db.add(university)
            db.flush()
            curriculum = Curriculum(
                university_id=university.id,
                name="Freshman Curriculum",
                version="2026.1",
                academic_year="2026/27",
                description="Demo curriculum for Phase 3 testing.",
                status="ACTIVE",
            )
            db.add(curriculum)
            db.flush()
            stream = Stream(
                curriculum_id=curriculum.id,
                name="Natural Science",
                code="NAT-SCI",
                description="Demo stream for curriculum import testing.",
                status="ACTIVE",
            )
            db.add(stream)
            db.flush()
            created.append({"university_id": university.id, "curriculum_id": curriculum.id, "stream_id": stream.id})
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Demo academic structure could not be created.") from exc

    return {"created": True, "items": created}


@router.post("/academic-structure-import/preview", response_model=FullStructurePreview)
async def preview_full_structure_import(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith((".txt", ".md")):
        raise HTTPException(status_code=415, detail="Upload a .txt or .md academic structure file.")
    raw = await file.read()
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="The academic structure file must be 5 MB or smaller.")
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="The academic structure file must be UTF-8 text.") from exc
    parsed = parse_full_structure(content)
    return {
        "university_name": parsed["university_name"],
        "university_code": parsed["university_code"],
        "curriculum_name": parsed["curriculum_name"],
        "curriculum_version": parsed["curriculum_version"],
        "academic_year": parsed["academic_year"],
        "stream_name": parsed["stream_name"],
        "stream_code": parsed["stream_code"],
        "courses": [
            {
                "name": course.name,
                "code": course.code,
                "chapters": [
                    {
                        "name": chapter.name,
                        "topics": [{"name": topic.name, "difficulty": topic.difficulty} for topic in chapter.topics],
                    }
                    for chapter in course.chapters
                ],
            }
            for course in parsed["courses"]
        ],
    }


@router.post("/academic-structure-import/commit", response_model=FullStructureResult, status_code=201)
def commit_full_structure_import(payload: FullStructurePreview, db: Session = DB):
    university = db.query(University).filter(University.code == payload.university_code).first()
    created_university = False

    if university is None:
        university = University(
            name=payload.university_name,
            code=payload.university_code,
            status="ACTIVE",
        )
        db.add(university)
        db.flush()
        created_university = True
    elif university.name != payload.university_name:
        raise HTTPException(status_code=409, detail="The university code already belongs to a different university.")

    existing_curriculum = db.query(Curriculum).filter(
        Curriculum.university_id == university.id,
        Curriculum.name == payload.curriculum_name,
        Curriculum.version == payload.curriculum_version,
    ).first()
    if existing_curriculum:
        raise HTTPException(status_code=409, detail="This curriculum version already exists for the selected university.")

    try:
        curriculum = Curriculum(
            university_id=university.id,
            name=payload.curriculum_name,
            version=payload.curriculum_version,
            academic_year=payload.academic_year,
            status="ACTIVE",
        )
        db.add(curriculum)
        db.flush()

        stream = Stream(
            curriculum_id=curriculum.id,
            name=payload.stream_name,
            code=payload.stream_code,
            status="ACTIVE",
        )
        db.add(stream)
        db.flush()

        created_courses = created_chapters = created_topics = 0
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
                    db.add(Topic(
                        chapter_id=chapter.id,
                        name=topic_payload.name,
                        difficulty=topic_payload.difficulty,
                        order_index=topic_index,
                        status="ACTIVE",
                    ))
                    created_topics += 1

        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The academic structure was not saved because a duplicate record exists.") from exc

    return {
        **payload.model_dump(),
        "university_id": university.id,
        "curriculum_id": curriculum.id,
        "stream_id": stream.id,
        "created_courses": created_courses,
        "created_chapters": created_chapters,
        "created_topics": created_topics,
    }

