from app.core.config import API_PREFIX
from app.core.deps import require_admin
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models.curriculum import Course, FreshmanCourseCategory
from app.db.session import get_db
from app.schemas.curriculum import (
    FreshmanCourseCategoryCreate,
    FreshmanCourseCategoryRead,
    FreshmanCourseCategoryUpdate,
    FreshmanCourseCreate,
    FreshmanCourseRead,
    FreshmanCourseUpdate,
)
from app.services.freshman_registry import (
    create_freshman_course,
    freshman_registry_key,
    get_freshman_course,
    set_categories,
)

router = APIRouter(prefix=f"{API_PREFIX}/freshman-registry", tags=["freshman-registry"], dependencies=[Depends(require_admin)])
DB = Annotated[Session, Depends(get_db)]


def _course_read(course: Course) -> FreshmanCourseRead:
    return FreshmanCourseRead(
        id=course.id,
        code=course.code,
        name=course.name,
        description=course.description,
        credit_hours=course.credit_hours,
        academic_scope=course.academic_scope,
        registry_key=course.registry_key,
        content_version=course.content_version,
        status=course.status,
        category_codes=[category.code for category in course.freshman_categories],
    )


@router.get("/categories", response_model=list[FreshmanCourseCategoryRead])
def list_categories(db: DB):
    return db.scalars(
        select(FreshmanCourseCategory).order_by(FreshmanCourseCategory.name)
    ).all()


@router.post("/categories", dependencies=[Depends(require_admin)], response_model=FreshmanCourseCategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(payload: FreshmanCourseCategoryCreate, db: DB):
    category = FreshmanCourseCategory(**payload.model_dump())
    db.add(category)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="A freshman category with the same code or name already exists.") from exc
    db.refresh(category)
    return category


@router.patch("/categories/{category_id}", dependencies=[Depends(require_admin)], response_model=FreshmanCourseCategoryRead)
def update_category(category_id: int, payload: FreshmanCourseCategoryUpdate, db: DB):
    category = db.get(FreshmanCourseCategory, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="Freshman course category not found.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The category update conflicts with an existing category.") from exc
    db.refresh(category)
    return category


@router.get("/courses", response_model=list[FreshmanCourseRead])
def list_freshman_courses(
    db: DB,
    category_code: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
):
    query = (
        select(Course)
        .options(selectinload(Course.freshman_categories))
        .where(Course.academic_scope == "FRESHMAN")
        .order_by(Course.code, Course.content_version)
    )
    if status_filter:
        query = query.where(Course.status == status_filter)
    if category_code:
        query = query.join(Course.freshman_categories).where(
            FreshmanCourseCategory.code == category_code.upper()
        )
    return [_course_read(course) for course in db.scalars(query).unique().all()]


@router.post("/courses", dependencies=[Depends(require_admin)], response_model=FreshmanCourseRead, status_code=status.HTTP_201_CREATED)
def create_course(payload: FreshmanCourseCreate, db: DB):
    existing = db.scalar(
        select(Course).where(
            Course.registry_key == freshman_registry_key(payload.code, payload.content_version)
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Freshman course {payload.code} version {payload.content_version} already exists.",
        )
    try:
        course = create_freshman_course(db, **payload.model_dump(exclude={"category_codes"}))
        set_categories(db, course, payload.category_codes)
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The freshman course conflicts with an existing registry record.") from exc
    db.refresh(course)
    course = get_freshman_course(db, course.id)
    return _course_read(course)


@router.get("/courses/{course_id}", response_model=FreshmanCourseRead)
def get_course(course_id: int, db: DB):
    course = db.scalar(
        select(Course)
        .options(selectinload(Course.freshman_categories))
        .where(Course.id == course_id, Course.academic_scope == "FRESHMAN")
    )
    if course is None:
        raise HTTPException(status_code=404, detail="Freshman course not found.")
    return _course_read(course)


@router.patch("/courses/{course_id}", dependencies=[Depends(require_admin)], response_model=FreshmanCourseRead)
def update_course(course_id: int, payload: FreshmanCourseUpdate, db: DB):
    course = db.scalar(
        select(Course)
        .options(selectinload(Course.freshman_categories))
        .where(Course.id == course_id, Course.academic_scope == "FRESHMAN")
    )
    if course is None:
        raise HTTPException(status_code=404, detail="Freshman course not found.")

    data = payload.model_dump(exclude_unset=True)
    category_codes = data.pop("category_codes", None)

    if "code" in data or "content_version" in data:
        new_code = data.get("code", course.code)
        new_version = data.get("content_version", course.content_version)
        new_key = freshman_registry_key(new_code, new_version)
        duplicate = db.scalar(
            select(Course).where(Course.registry_key == new_key, Course.id != course.id)
        )
        if duplicate is not None:
            raise HTTPException(status_code=409, detail="Another freshman course already uses that code/version identity.")
        data["registry_key"] = new_key

    for key, value in data.items():
        setattr(course, key, value)

    if category_codes is not None:
        try:
            set_categories(db, course, category_codes)
        except ValueError as exc:
            db.rollback()
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The freshman course update conflicts with the registry.") from exc
    db.refresh(course)
    return _course_read(course)
