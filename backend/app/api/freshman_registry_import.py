from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.curriculum import Chapter, Course, Topic
from app.db.session import get_db
from app.schemas.freshman_registry_import import FreshmanRegistryPreview, FreshmanRegistryResult
from app.services.freshman_registry_parser import parse_bullet_curriculum
from app.services.freshman_registry import create_freshman_course, freshman_registry_key, set_categories

router = APIRouter(prefix="/api/v1/freshman-registry-import", tags=["freshman-registry-import"])
DB = Depends(get_db)
MAX_FILE_SIZE = 5 * 1024 * 1024


def _preview_course(course, content_version: str, category_codes: list[str]) -> FreshmanRegistryPreview:
    return FreshmanRegistryPreview(
        code=course.code,
        name=course.name,
        content_version=content_version,
        category_codes=category_codes,
        chapters=[
            {
                "name": chapter.name,
                "topics": [
                    {"name": topic.name, "difficulty": topic.difficulty}
                    for topic in chapter.topics
                ],
            }
            for chapter in course.chapters
        ],
    )


@router.post("/preview", response_model=list[FreshmanRegistryPreview])
async def preview_freshman_registry_import(
    file: UploadFile = File(...),
    content_version: str = "1.0",
    db: Session = DB,
):
    if not file.filename or not file.filename.lower().endswith((".txt", ".md")):
        raise HTTPException(status_code=415, detail="Upload a .txt or .md freshman course file.")
    raw = await file.read()
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="The freshman course file must be 5 MB or smaller.")
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="The freshman course file must be UTF-8 text.") from exc

    parsed = parse_bullet_curriculum(content)
    previews = []
    for course in parsed:
        key = freshman_registry_key(course.code, content_version)
        if db.scalar(select(Course.id).where(Course.registry_key == key)):
            raise HTTPException(
                status_code=409,
                detail=f"Freshman course {course.code} version {content_version} already exists.",
            )
        previews.append(_preview_course(course, content_version, []))
    return previews


@router.post("/commit", response_model=list[FreshmanRegistryResult], status_code=201)
def commit_freshman_registry_import(payload: list[FreshmanRegistryPreview], db: Session = DB):
    if not payload:
        raise HTTPException(status_code=422, detail="The import contains no freshman courses.")

    created = []
    try:
        for item in payload:
            key = freshman_registry_key(item.code, item.content_version)
            if db.scalar(select(Course.id).where(Course.registry_key == key)):
                raise HTTPException(
                    status_code=409,
                    detail=f"Freshman course {item.code} version {item.content_version} already exists.",
                )

            course = create_freshman_course(
                db,
                code=item.code,
                name=item.name,
                content_version=item.content_version,
                category_codes=item.category_codes,
            )
            db.flush()

            for chapter_index, chapter_data in enumerate(item.chapters, start=1):
                chapter = Chapter(
                    course_id=course.id,
                    name=chapter_data.name,
                    order_index=chapter_index,
                )
                db.add(chapter)
                db.flush()
                for topic_index, topic_data in enumerate(chapter_data.topics, start=1):
                    db.add(
                        Topic(
                            chapter_id=chapter.id,
                            name=topic_data.name,
                            difficulty=topic_data.difficulty,
                            order_index=topic_index,
                        )
                    )
            created.append((course, len(item.chapters), sum(len(ch.topics) for ch in item.chapters)))

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The freshman registry import could not be saved.") from exc

    return [
        FreshmanRegistryResult(
            code=course.code,
            name=course.name,
            content_version=course.content_version,
            category_codes=[category.code for category in course.freshman_categories],
            chapters=[],
            course_id=course.id,
            registry_key=course.registry_key,
            created_chapters=chapter_count,
            created_topics=topic_count,
        )
        for course, chapter_count, topic_count in created
    ]
