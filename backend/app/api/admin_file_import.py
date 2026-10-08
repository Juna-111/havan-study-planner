from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.core.config import API_PREFIX
from app.core.deps import require_admin
from app.core.errors import DomainError
from app.db.session import get_db
from app.schemas.admin_file_import import PromotionImportPreview,PromotionImportResult,UniversityImportPreview,UniversityImportResult
from app.services.admin_file_import import MAX_FILE_SIZE,commit_promotion_import,commit_university_import,parse_promotion_file,parse_university_csv,preview_promotion_import,preview_university_import

router=APIRouter(prefix=f"{API_PREFIX}/admin-file-import",tags=["admin-file-import"],dependencies=[Depends(require_admin)])


def _assert_payload_within_limit(request: Request, file: UploadFile, label: str) -> None:
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
            f"The {label} must be 5 MB or smaller.",
            413,
        )


@router.post("/university/preview",response_model=UniversityImportPreview)
async def preview_university(request: Request, file:UploadFile=File(...),db:Session=Depends(get_db)):
 if not file.filename or not file.filename.lower().endswith(".csv"):raise HTTPException(415,"Upload a .csv university file.")
 _assert_payload_within_limit(request, file, "university CSV")
 raw=await file.read()
 if len(raw)>MAX_FILE_SIZE:raise HTTPException(413,"The university CSV must be 5 MB or smaller.")
 rows=parse_university_csv(raw);return preview_university_import(rows,db)


@router.post("/university/commit",response_model=UniversityImportResult)
async def commit_university(request: Request, file:UploadFile=File(...),db:Session=Depends(get_db)):
 if not file.filename or not file.filename.lower().endswith(".csv"):raise HTTPException(415,"Upload a .csv university file.")
 _assert_payload_within_limit(request, file, "university CSV")
 raw=await file.read()
 if len(raw)>MAX_FILE_SIZE:raise HTTPException(413,"The university CSV must be 5 MB or smaller.")
 rows=parse_university_csv(raw);preview_university_import(rows);return commit_university_import(db,rows)


@router.post("/promotion/preview",response_model=PromotionImportPreview)
async def preview_promotion(request: Request, file:UploadFile=File(...),db:Session=Depends(get_db)):
 if not file.filename or not file.filename.lower().endswith((".txt",".md")):raise HTTPException(415,"Upload a .txt or .md promotion file.")
 _assert_payload_within_limit(request, file, "promotion file")
 raw=await file.read()
 if len(raw)>MAX_FILE_SIZE:raise HTTPException(413,"The promotion file must be 5 MB or smaller.")
 rows=parse_promotion_file(raw);return preview_promotion_import(db,rows)


@router.post("/promotion/commit",response_model=PromotionImportResult)
async def commit_promotion(request: Request, file:UploadFile=File(...),db:Session=Depends(get_db)):
 if not file.filename or not file.filename.lower().endswith((".txt",".md")):raise HTTPException(415,"Upload a .txt or .md promotion file.")
 _assert_payload_within_limit(request, file, "promotion file")
 raw=await file.read()
 if len(raw)>MAX_FILE_SIZE:raise HTTPException(413,"The promotion file must be 5 MB or smaller.")
 return commit_promotion_import(db,parse_promotion_file(raw))
