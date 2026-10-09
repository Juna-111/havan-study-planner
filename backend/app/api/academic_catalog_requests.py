from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import API_PREFIX
from app.core.deps import current_account, require_admin
from app.db.models.academic_catalog_request import AcademicCatalogRequest
from app.db.models.academic_catalog import Stream, University
from app.db.session import get_db
from app.schemas.academic_catalog_request import (
    AcademicCatalogRequestCreate,
    AcademicCatalogRequestRead,
    AcademicCatalogRequestReview,
)

router = APIRouter(
    prefix=f"{API_PREFIX}/academic-catalog-requests",
    tags=["academic-catalog-requests"],
    dependencies=[Depends(current_account)],
)
DB = Annotated[Session, Depends(get_db)]
Account = Annotated[object, Depends(current_account)]


def _read(item: AcademicCatalogRequest) -> AcademicCatalogRequestRead:
    return AcademicCatalogRequestRead.model_validate(item)


@router.get("/mine", response_model=list[AcademicCatalogRequestRead])
def list_my_requests(db: DB, account: Account):
    rows = db.scalars(
        select(AcademicCatalogRequest)
        .where(AcademicCatalogRequest.account_id == account.id)
        .where(AcademicCatalogRequest.request_type.in_(("UNIVERSITY", "STREAM")))
        .order_by(AcademicCatalogRequest.created_at.desc())
    ).all()
    return [_read(row) for row in rows]


@router.post("", response_model=AcademicCatalogRequestRead, status_code=status.HTTP_201_CREATED)
def create_request(payload: AcademicCatalogRequestCreate, db: DB, account: Account):
    if payload.request_type == "STREAM":
        if payload.university_id is None:
            raise HTTPException(status_code=400, detail="Select a university before requesting a stream.")
        if db.get(University, payload.university_id) is None:
            raise HTTPException(status_code=404, detail="University not found.")
        if not payload.code:
            raise HTTPException(status_code=400, detail="A stream code is required.")

    pending = db.scalar(
        select(AcademicCatalogRequest).where(
            AcademicCatalogRequest.account_id == account.id,
            AcademicCatalogRequest.request_type == payload.request_type,
            AcademicCatalogRequest.name == payload.name,
            AcademicCatalogRequest.status == "PENDING",
        )
    )
    if pending is not None:
        return _read(pending)

    item = AcademicCatalogRequest(account_id=account.id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _read(item)


@router.get("", response_model=list[AcademicCatalogRequestRead], dependencies=[Depends(require_admin)])
def list_requests(db: DB):
    rows = db.scalars(
        select(AcademicCatalogRequest)
        .where(AcademicCatalogRequest.request_type.in_(("UNIVERSITY", "STREAM")))
        .order_by(AcademicCatalogRequest.created_at.desc())
    ).all()
    return [_read(row) for row in rows]


def _safe_code(name: str) -> str:
    compact = "".join(char for char in name.upper() if char.isalnum())
    return (compact[:30] or "UNI")


@router.patch("/{request_id}", response_model=AcademicCatalogRequestRead, dependencies=[Depends(require_admin)])
def review_request(
    request_id: int,
    payload: AcademicCatalogRequestReview,
    db: DB,
):
    item = db.get(AcademicCatalogRequest, request_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Academic catalog request not found.")
    if item.status != "PENDING":
        raise HTTPException(status_code=409, detail="This request has already been reviewed.")

    item.admin_note = payload.admin_note
    if payload.status == "REJECTED":
        item.status = "REJECTED"
        db.commit()
        db.refresh(item)
        return _read(item)

    if item.request_type == "UNIVERSITY":
        code = (item.code or _safe_code(item.name)).strip()
        existing = db.scalar(select(University).where(University.code == code))
        if existing is not None:
            item.status = "APPROVED"
        else:
            db.add(University(name=item.name.strip(), code=code, status="ACTIVE"))
            item.status = "APPROVED"
    elif item.request_type == "STREAM":
        if item.university_id is None:
            raise HTTPException(status_code=400, detail="Stream request has no university.")
        if db.get(University, item.university_id) is None:
            raise HTTPException(status_code=400, detail="The requested stream university no longer exists.")
        existing = db.scalar(
            select(Stream).where(
                Stream.university_id == item.university_id,
                Stream.name == item.name,
                Stream.code == item.code,
            )
        )
        if existing is None:
            db.add(
                Stream(
                    university_id=item.university_id,
                    name=item.name.strip(),
                    code=(item.code or _safe_code(item.name)).strip().upper(),
                    status="ACTIVE",
                )
            )
        item.status = "APPROVED"

    db.commit()
    db.refresh(item)
    return _read(item)
