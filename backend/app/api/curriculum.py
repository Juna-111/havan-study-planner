from app.core.config import API_PREFIX
from app.core.deps import current_account, require_admin
from typing import Annotated, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.db.models.curriculum import (
    Chapter,
    Course,
    Curriculum,
    HavanPromotion,
    Stream,
    Topic,
    University,
    UniversityCourseMapping,
    UniversityCourseOffering,
)
from app.schemas.curriculum import *
from app.services.academic_resolver import resolve_stream_courses
from app.services.curriculum import get_or_404, list_items

router = APIRouter(prefix=API_PREFIX, tags=["curriculum"], dependencies=[Depends(current_account)])
DB = Annotated[Session, Depends(get_db)]


def page_params(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)):
    return page, page_size

def collection(db, model, schema, page, page_size, filters=None):
    items,total,pages=list_items(db,model,page,page_size,filters)
    return {"items":[schema.model_validate(x) for x in items],"page":page,"page_size":page_size,"total":total,"pages":pages}

@router.get("/universities")
def universities(db: DB, page: int=Query(1,ge=1), page_size: int=Query(20,ge=1,le=100)):
    return collection(db,University,UniversityRead,page,page_size)
@router.get("/curriculums")
def curriculums(db:DB, university_id:int|None=None,page:int=Query(1,ge=1),page_size:int=Query(20,ge=1,le=100)):
    return collection(db,Curriculum,CurriculumRead,page,page_size,{"university_id":university_id})
@router.get("/curriculums/{item_id}",response_model=CurriculumRead)
def get_curriculum(item_id:int,db:DB): return get_or_404(db,Curriculum,item_id)
@router.get("/streams")
def streams(db:DB,curriculum_id:int|None=None,page:int=Query(1,ge=1),page_size:int=Query(20,ge=1,le=100)):
    return collection(db,Stream,StreamRead,page,page_size,{"curriculum_id":curriculum_id})
@router.get("/streams/{item_id}",response_model=StreamRead)
def get_stream(item_id:int,db:DB): return get_or_404(db,Stream,item_id)
@router.get("/courses")
def courses(
    db: DB,
    stream_id: int | None = Query(None),
    include_freshman: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    if not include_freshman or stream_id is None:
        return collection(db, Course, CourseRead, page, page_size, {"stream_id": stream_id})

    if db.get(Stream, stream_id) is None:
        return {"items": [], "page": page, "page_size": page_size, "total": 0, "pages": 0}

    resolved = resolve_stream_courses(db, stream_id)
    total = len(resolved)
    start_index = (page - 1) * page_size
    selected = resolved[start_index:start_index + page_size]
    items = [
        CourseRead.model_validate(db.get(Course, item.course_id)).model_copy(update={
            "code": item.display_code,
            "name": item.display_name,
            "credit_hours": item.credit_hours,
        })
        for item in selected
    ]
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "pages": (total + page_size - 1) // page_size if total else 0,
    }
@router.get("/courses/{item_id}",response_model=CourseRead)
def get_course(item_id:int,db:DB): return get_or_404(db,Course,item_id)
@router.get("/chapters")
def chapters(db:DB,course_id:int|None=None,page:int=Query(1,ge=1),page_size:int=Query(20,ge=1,le=100)):
    return collection(db,Chapter,ChapterRead,page,page_size,{"course_id":course_id})
@router.get("/chapters/{item_id}",response_model=ChapterRead)
def get_chapter(item_id:int,db:DB): return get_or_404(db,Chapter,item_id)
@router.patch("/chapters/{item_id}",response_model=ChapterRead,dependencies=[Depends(require_admin)])
def update_chapter(item_id:int,payload:ChapterUpdate,db:DB):
    item=get_or_404(db,Chapter,item_id)
    for key,value in payload.model_dump(exclude_unset=True).items(): setattr(item,key,value)
    db.commit(); db.refresh(item)
    return item
@router.get("/topics")
def topics(db:DB,chapter_id:int|None=None,page:int=Query(1,ge=1),page_size:int=Query(20,ge=1,le=100)):
    return collection(db,Topic,TopicRead,page,page_size,{"chapter_id":chapter_id})
@router.get("/topics/{item_id}",response_model=TopicRead)
def get_topic(item_id:int,db:DB): return get_or_404(db,Topic,item_id)
@router.patch("/topics/{item_id}",response_model=TopicRead,dependencies=[Depends(require_admin)])
def update_topic(item_id:int,payload:TopicUpdate,db:DB):
    item=get_or_404(db,Topic,item_id)
    for key,value in payload.model_dump(exclude_unset=True).items(): setattr(item,key,value)
    db.commit(); db.refresh(item)
    return item
@router.get("/promotions")
def promotions(db: DB, chapter_id: int | None = None, topic_id: int | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100)):
    if (chapter_id is None) == (topic_id is None): raise HTTPException(status_code=400, detail="Choose a chapter or topic.")
    return collection(db, HavanPromotion, PromotionRead, page, page_size, {"chapter_id": chapter_id, "topic_id": topic_id})

def delete_promotion(item_id: int, db: DB): delete_item(db, get_or_404(db, HavanPromotion, item_id))
