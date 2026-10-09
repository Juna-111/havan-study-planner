from math import ceil
from typing import Any, Type
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.db.models.academic_catalog import Chapter, Course, Stream, Topic, University

MODEL_MAP: dict[str, Type[Any]] = {
    "universities": University, "streams": Stream,
    "courses": Course, "chapters": Chapter, "topics": Topic,
}


def list_items(db: Session, model: Type[Any], page: int, page_size: int, filters: dict[str, Any] | None = None):
    query = select(model)
    for key, value in (filters or {}).items():
        if value is not None and hasattr(model, key): query = query.where(getattr(model, key) == value)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = list(db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all())
    return items, total, ceil(total / page_size) if total else 0


def get_or_404(db: Session, model: Type[Any], item_id: int):
    item = db.get(model, item_id)
    if item is None: raise HTTPException(status_code=404, detail=f"{model.__name__} {item_id} not found")
    return item


def create_item(db: Session, model: Type[Any], data: dict[str, Any]):
    item = model(**data); db.add(item)
    try: db.commit()
    except Exception:
        db.rollback(); raise HTTPException(status_code=409, detail="A record with the same unique identity already exists")
    db.refresh(item); return item


def update_item(db: Session, item: Any, data: dict[str, Any]):
    for key, value in data.items(): setattr(item, key, value)
    try: db.commit()
    except Exception:
        db.rollback(); raise HTTPException(status_code=409, detail="The update conflicts with an existing unique record")
    db.refresh(item); return item


def delete_item(db: Session, item: Any):
    db.delete(item); db.commit()
