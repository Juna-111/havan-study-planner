from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.core.config import API_PREFIX
from app.core.deps import require_admin
from app.db.session import get_db
from app.schemas.admin_file_import import PromotionImportPreview,PromotionImportResult,UniversityImportPreview,UniversityImportResult
from app.services.admin_file_import import MAX_FILE_SIZE,commit_promotion_import,commit_university_import,parse_promotion_file,parse_university_csv,preview_promotion_import,preview_university_import
router=APIRouter(prefix=f"{API_PREFIX}/admin-file-import",tags=["admin-file-import"],dependencies=[Depends(require_admin)])
@router.post("/university/preview",response_model=UniversityImportPreview)
async def preview_university(file:UploadFile=File(...),db:Session=Depends(get_db)):
 if not file.filename or not file.filename.lower().endswith(".csv"):raise HTTPException(415,"Upload a .csv university file.")
 raw=await file.read()
 if len(raw)>MAX_FILE_SIZE:raise HTTPException(413,"The university CSV must be 5 MB or smaller.")
 rows=parse_university_csv(raw);return preview_university_import(rows,db)
@router.post("/university/commit",response_model=UniversityImportResult)
async def commit_university(file:UploadFile=File(...),db:Session=Depends(get_db)):
 if not file.filename or not file.filename.lower().endswith(".csv"):raise HTTPException(415,"Upload a .csv university file.")
 raw=await file.read()
 if len(raw)>MAX_FILE_SIZE:raise HTTPException(413,"The university CSV must be 5 MB or smaller.")
 rows=parse_university_csv(raw);preview_university_import(rows);return commit_university_import(db,rows)
@router.post("/promotion/preview",response_model=PromotionImportPreview)
async def preview_promotion(file:UploadFile=File(...),db:Session=Depends(get_db)):
 if not file.filename or not file.filename.lower().endswith((".txt",".md")):raise HTTPException(415,"Upload a .txt or .md promotion file.")
 raw=await file.read()
 if len(raw)>MAX_FILE_SIZE:raise HTTPException(413,"The promotion file must be 5 MB or smaller.")
 rows=parse_promotion_file(raw);return preview_promotion_import(db,rows)
@router.post("/promotion/commit",response_model=PromotionImportResult)
async def commit_promotion(file:UploadFile=File(...),db:Session=Depends(get_db)):
 if not file.filename or not file.filename.lower().endswith((".txt",".md")):raise HTTPException(415,"Upload a .txt or .md promotion file.")
 raw=await file.read()
 if len(raw)>MAX_FILE_SIZE:raise HTTPException(413,"The promotion file must be 5 MB or smaller.")
 return commit_promotion_import(db,parse_promotion_file(raw))
