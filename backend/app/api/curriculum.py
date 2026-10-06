from app.core.config import API_PREFIX
from typing import Annotated, Any
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from app.db.session import get_db
from app.db.models.curriculum import Chapter, Course, Curriculum, Stream, Topic, University, UniversityCourseMapping
from app.schemas.curriculum import *
from app.services.academic_resolver import resolve_stream_courses
from app.services.curriculum import create_item, delete_item, get_or_404, list_items, update_item

router = APIRouter(prefix=API_PREFIX, tags=["curriculum"])
DB = Annotated[Session, Depends(get_db)]


def page_params(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)):
    return page, page_size

def collection(db, model, schema, page, page_size, filters=None):
    items,total,pages=list_items(db,model,page,page_size,filters)
    return {"items":[schema.model_validate(x) for x in items],"page":page,"page_size":page_size,"total":total,"pages":pages}

@router.get("/universities")
def universities(db: DB, page: int=Query(1,ge=1), page_size: int=Query(20,ge=1,le=100)):
    return collection(db,University,UniversityRead,page,page_size)
@router.post("/universities", response_model=UniversityRead, status_code=status.HTTP_201_CREATED)
def create_university(payload: UniversityCreate, db: DB): return create_item(db,University,payload.model_dump())
@router.get("/universities/{item_id}", response_model=UniversityRead)
def get_university(item_id:int,db:DB): return get_or_404(db,University,item_id)
@router.patch("/universities/{item_id}", response_model=UniversityRead)
def update_university(item_id:int,payload:UniversityUpdate,db:DB): return update_item(db,get_or_404(db,University,item_id),payload.model_dump(exclude_unset=True))
@router.delete("/universities/{item_id}",status_code=204)
def delete_university(item_id:int,db:DB): delete_item(db,get_or_404(db,University,item_id))

@router.get("/curriculums")
def curriculums(db:DB, university_id:int|None=None,page:int=Query(1,ge=1),page_size:int=Query(20,ge=1,le=100)):
    return collection(db,Curriculum,CurriculumRead,page,page_size,{"university_id":university_id})
@router.post("/curriculums",response_model=CurriculumRead,status_code=201)
def create_curriculum(payload:CurriculumCreate,db:DB): return create_item(db,Curriculum,payload.model_dump())
@router.get("/curriculums/{item_id}",response_model=CurriculumRead)
def get_curriculum(item_id:int,db:DB): return get_or_404(db,Curriculum,item_id)
@router.patch("/curriculums/{item_id}",response_model=CurriculumRead)
def update_curriculum(item_id:int,payload:CurriculumUpdate,db:DB): return update_item(db,get_or_404(db,Curriculum,item_id),payload.model_dump(exclude_unset=True))
@router.delete("/curriculums/{item_id}",status_code=204)
def delete_curriculum(item_id:int,db:DB): delete_item(db,get_or_404(db,Curriculum,item_id))

@router.get("/streams")
def streams(db:DB,curriculum_id:int|None=None,page:int=Query(1,ge=1),page_size:int=Query(20,ge=1,le=100)):
    return collection(db,Stream,StreamRead,page,page_size,{"curriculum_id":curriculum_id})
@router.post("/streams",response_model=StreamRead,status_code=201)
def create_stream(payload:StreamCreate,db:DB): return create_item(db,Stream,payload.model_dump())
@router.get("/streams/{item_id}",response_model=StreamRead)
def get_stream(item_id:int,db:DB): return get_or_404(db,Stream,item_id)
@router.patch("/streams/{item_id}",response_model=StreamRead)
def update_stream(item_id:int,payload:StreamUpdate,db:DB): return update_item(db,get_or_404(db,Stream,item_id),payload.model_dump(exclude_unset=True))
@router.delete("/streams/{item_id}",status_code=204)
def delete_stream(item_id:int,db:DB): delete_item(db,get_or_404(db,Stream,item_id))

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
@router.post("/courses",response_model=CourseRead,status_code=201)
def create_course(payload:CourseCreate,db:DB):
    data = payload.model_dump()
    data['academic_scope'] = 'UNIVERSITY'
    data['content_version'] = '1.0'
    data['registry_key'] = f'UNIVERSITY:{payload.stream_id}:{payload.code.strip()}'
    return create_item(db,Course,data)
@router.get("/courses/{item_id}",response_model=CourseRead)
def get_course(item_id:int,db:DB): return get_or_404(db,Course,item_id)
@router.patch("/courses/{item_id}",response_model=CourseRead)
def update_course(item_id:int,payload:CourseUpdate,db:DB): return update_item(db,get_or_404(db,Course,item_id),payload.model_dump(exclude_unset=True))
@router.delete("/courses/{item_id}",status_code=204)
def delete_course(item_id:int,db:DB): delete_item(db,get_or_404(db,Course,item_id))

@router.get("/chapters")
def chapters(db:DB,course_id:int|None=None,page:int=Query(1,ge=1),page_size:int=Query(20,ge=1,le=100)):
    return collection(db,Chapter,ChapterRead,page,page_size,{"course_id":course_id})
@router.post("/chapters",response_model=ChapterRead,status_code=201)
def create_chapter(payload:ChapterCreate,db:DB): return create_item(db,Chapter,payload.model_dump())
@router.get("/chapters/{item_id}",response_model=ChapterRead)
def get_chapter(item_id:int,db:DB): return get_or_404(db,Chapter,item_id)
@router.patch("/chapters/{item_id}",response_model=ChapterRead)
def update_chapter(item_id:int,payload:ChapterUpdate,db:DB): return update_item(db,get_or_404(db,Chapter,item_id),payload.model_dump(exclude_unset=True))
@router.delete("/chapters/{item_id}",status_code=204)
def delete_chapter(item_id:int,db:DB): delete_item(db,get_or_404(db,Chapter,item_id))

@router.get("/topics")
def topics(db:DB,chapter_id:int|None=None,page:int=Query(1,ge=1),page_size:int=Query(20,ge=1,le=100)):
    return collection(db,Topic,TopicRead,page,page_size,{"chapter_id":chapter_id})
@router.post("/topics",response_model=TopicRead,status_code=201)
def create_topic(payload:TopicCreate,db:DB): return create_item(db,Topic,payload.model_dump())
@router.get("/topics/{item_id}",response_model=TopicRead)
def get_topic(item_id:int,db:DB): return get_or_404(db,Topic,item_id)
@router.patch("/topics/{item_id}",response_model=TopicRead)
def update_topic(item_id:int,payload:TopicUpdate,db:DB): return update_item(db,get_or_404(db,Topic,item_id),payload.model_dump(exclude_unset=True))
@router.delete("/topics/{item_id}",status_code=204)
def delete_topic(item_id:int,db:DB): delete_item(db,get_or_404(db,Topic,item_id))
