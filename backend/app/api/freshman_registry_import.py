from app.core.config import API_PREFIX
from app.core.deps import require_admin
from app.core.errors import DomainError
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models.curriculum import Chapter, Course, Topic
from app.db.session import get_db
from app.schemas.freshman_registry_import import FreshmanRegistryPreview, FreshmanRegistryResult
from app.services.freshman_registry import create_freshman_course, freshman_registry_key
from app.services.freshman_registry_parser import parse_bullet_curriculum

router = APIRouter(
    prefix=f"{API_PREFIX}/freshman-registry-import",
    tags=["freshman-registry-import"],
    dependencies=[Depends(require_admin)],
)
DB = Depends(get_db)
MAX_FILE_SIZE = 5 * 1024 * 1024


def _assert_file_within_limit(request: Request, file: UploadFile) -> None:
    size_known = file.size is not None and file.size > MAX_FILE_SIZE
    try:
        cl_hdr = request.headers.get("content-length")
        cl_known = False
        if cl_hdr is not None:
            try:
                if int(cl_hdr) > MAX_FILE_SIZE:
                    cl_known = True
            except ValueError:
                cl_known = False
    except Exception:
        cl_known = False
    if size_known or cl_known:
        raise DomainError(
            "PAYLOAD_TOO_LARGE",
            "The freshman course file must be 5 MB or smaller.",
            413,
        )


def _read_courses(raw: bytes, content_version: str):
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="The freshman course file must be 5 MB or smaller.")
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="The freshman course file must be UTF-8 text.") from exc

    version = content_version.strip() or "1.0"
    parsed = parse_bullet_curriculum(content)
    seen_keys: set[str] = set()
    for course in parsed:
        key = freshman_registry_key(course.code, version)
        if key in seen_keys:
            raise HTTPException(status_code=422, detail=f"Duplicate course identity '{key}' in the uploaded file.")
        seen_keys.add(key)
    return parsed, version


def _course_matches(course: Course, parsed_course, version: str) -> bool:
    if course.name.strip().casefold() != parsed_course.name.strip().casefold():
        return False
    chapters = sorted(course.chapters, key=lambda item: item.order_index)
    if len(chapters) != len(parsed_course.chapters):
        return False
    for existing, incoming in zip(chapters, parsed_course.chapters):
        if existing.name.strip().casefold() != incoming.name.strip().casefold():
            return False
        topics = sorted(existing.topics, key=lambda item: item.order_index)
        if len(topics) != len(incoming.topics):
            return False
        for existing_topic, incoming_topic in zip(topics, incoming.topics):
            if existing_topic.name.strip().casefold() != incoming_topic.name.strip().casefold():
                return False
            if existing_topic.difficulty != incoming_topic.difficulty:
                return False
            if (existing_topic.important_points or "").strip() != (incoming_topic.important_points or "").strip():
                return False
    return course.content_version.strip() == version


def _preview(parsed_course, version: str, action: str) -> FreshmanRegistryPreview:
    return FreshmanRegistryPreview(
        code=parsed_course.code,
        name=parsed_course.name,
        content_version=version,
        category_codes=[],
        chapters=[
            {
                "name": chapter.name,
                "topics": [
                    {
                        "name": topic.name,
                        "difficulty": topic.difficulty,
                        "important_points": topic.important_points,
                    }
                    for topic in chapter.topics
                ],
            }
            for chapter in parsed_course.chapters
        ],
        action=action,
    )


@router.post("/preview", response_model=list[FreshmanRegistryPreview])
async def preview_freshman_registry_import(
    request: Request,
    file: UploadFile = File(...),
    content_version: str = "1.0",
    db: Session = DB,
):
    if not file.filename or not file.filename.lower().endswith((".txt", ".md")):
        raise HTTPException(status_code=415, detail="Upload a .txt or .md freshman course file.")

    _assert_file_within_limit(request, file)
    raw = await file.read()
    parsed, version = _read_courses(raw, content_version)
    previews: list[FreshmanRegistryPreview] = []

    for incoming in parsed:
        key = freshman_registry_key(incoming.code, version)
        existing = db.scalar(select(Course).where(Course.registry_key == key))
        action = "NEW"
        if existing is not None:
            action = "UNCHANGED" if _course_matches(existing, incoming, version) else "CONFLICT"
        previews.append(_preview(incoming, version, action))

    if any(item.action == "CONFLICT" for item in previews):
        raise HTTPException(
            status_code=409,
            detail="One or more course versions already exist with different content. Increase content_version and upload the new version.",
        )
    return previews


@router.post("/commit", response_model=list[FreshmanRegistryResult])
async def commit_freshman_registry_import(
    request: Request,
    file: UploadFile = File(...),
    content_version: str = "1.0",
    db: Session = DB,
):
    if not file.filename or not file.filename.lower().endswith((".txt", ".md")):
        raise HTTPException(status_code=415, detail="Upload a .txt or .md freshman course file.")

    _assert_file_within_limit(request, file)
    raw = await file.read()
    parsed, version = _read_courses(raw, content_version)
    results: list[FreshmanRegistryResult] = []

    try:
        for incoming in parsed:
            key = freshman_registry_key(incoming.code, version)
            existing = db.scalar(select(Course).where(Course.registry_key == key))

            if existing is not None:
                if _course_matches(existing, incoming, version):
                    results.append(
                        FreshmanRegistryResult(
                            **_preview(incoming, version, "UNCHANGED").model_dump(),
                            course_id=existing.id,
                            registry_key=existing.registry_key,
                            created_chapters=0,
                            created_topics=0,
                        )
                    )
                    continue
                raise HTTPException(
                    status_code=409,
                    detail=f"Course {incoming.code} version {version} already exists with different content. Increase content_version.",
                )

            course = create_freshman_course(
                db,
                code=incoming.code,
                name=incoming.name,
                content_version=version,
                category_codes=[],
            )
            db.flush()

            for chapter_index, chapter_data in enumerate(incoming.chapters, start=1):
                chapter = Chapter(course_id=course.id, name=chapter_data.name, order_index=chapter_index)
                db.add(chapter)
                db.flush()
                for topic_index, topic_data in enumerate(chapter_data.topics, start=1):
                    db.add(
                        Topic(
                            chapter_id=chapter.id,
                            name=topic_data.name,
                            difficulty=topic_data.difficulty,
                            important_points=topic_data.important_points,
                            order_index=topic_index,
                        )
                    )

            results.append(
                FreshmanRegistryResult(
                    **_preview(incoming, version, "CREATED").model_dump(),
                    course_id=course.id,
                    registry_key=course.registry_key,
                    created_chapters=len(incoming.chapters),
                    created_topics=sum(len(chapter.topics) for chapter in incoming.chapters),
                )
            )

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="The import conflicts with an existing registry record. Re-upload the same source and retry.",
        ) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="The freshman registry import failed unexpectedly. No records were saved.",
        ) from exc

    return results
