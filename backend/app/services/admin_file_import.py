from __future__ import annotations

import csv, io, re
from dataclasses import dataclass
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db.models.curriculum import Chapter, Course, Curriculum, HavanPromotion, Stream, Topic, University, UniversityCourseMapping

MAX_FILE_SIZE=5*1024*1024
CSV_COLUMNS={"university_code","university_name","curriculum","curriculum_version","academic_year","stream_code","stream_name","semester","course_code","course_name","credit_hours"}
@dataclass
class UniversityImportRow:
 line:int; university_code:str; university_name:str; curriculum:str; curriculum_version:str; academic_year:str|None; stream_code:str; stream_name:str; semester:int; course_code:str; course_name:str; credit_hours:int|None
@dataclass
class PromotionImportRow:
 line:int; course_code:str; chapter_name:str; topic_name:str|None; platform_name:str; description:str|None; button_text:str; url:str; order_index:int; status:str
def _clean(v:str|None)->str:return(v or "").strip()
def parse_university_csv(raw:bytes)->list[UniversityImportRow]:
 try:text=raw.decode("utf-8-sig")
 except UnicodeDecodeError as e:raise HTTPException(422,"The university CSV must be UTF-8 text.") from e
 reader=csv.DictReader(io.StringIO(text)); headers={_clean(h).lower() for h in(reader.fieldnames or [])}; missing=sorted(CSV_COLUMNS-headers)
 if missing:raise HTTPException(422,"University CSV is missing columns: "+", ".join(missing))
 rows=[]
 for line,raw_row in enumerate(reader,2):
  row={str(k).strip().lower():_clean(v) for k,v in raw_row.items() if k is not None}; required=["university_code","university_name","curriculum","curriculum_version","stream_code","stream_name","semester","course_code","course_name"]
  if any(not row.get(k) for k in required):raise HTTPException(422,f"University CSV line {line}: required value is missing.")
  try:semester=int(row["semester"])
  except ValueError as e:raise HTTPException(422,f"University CSV line {line}: semester must be 1 or 2.") from e
  if semester not in(1,2):raise HTTPException(422,f"University CSV line {line}: semester must be 1 or 2.")
  credit=None
  if row.get("credit_hours"):
   try:credit=int(row["credit_hours"])
   except ValueError as e:raise HTTPException(422,f"University CSV line {line}: credit_hours must be an integer.") from e
   if not 0<=credit<=30:raise HTTPException(422,f"University CSV line {line}: credit_hours must be between 0 and 30.")
  rows.append(UniversityImportRow(line,row["university_code"],row["university_name"],row["curriculum"],row["curriculum_version"],row.get("academic_year") or None,row["stream_code"],row["stream_name"],semester,row["course_code"],row["course_name"],credit))
 if not rows:raise HTTPException(422,"The university CSV contains no data rows.")
 return rows
def _promotion_blocks(text:str)->list[dict[str,str]]:
 result=[]
 for block in re.split(r"\n\s*\n",text.replace("\r\n","\n").strip()):
  values={}
  for raw in block.splitlines():
   line=raw.strip().lstrip("#").strip()
   if ":" in line:
    k,v=line.split(":",1);values[k.strip().lower().replace(" ","_")]=v.strip()
  if values:result.append(values)
 return result
def parse_promotion_file(raw:bytes)->list[PromotionImportRow]:
 try:text=raw.decode("utf-8-sig")
 except UnicodeDecodeError as e:raise HTTPException(422,"The Havan promotion file must be UTF-8 text.") from e
 result=[];required=["course_code","chapter","platform_name","button_text","url"]
 for i,row in enumerate(_promotion_blocks(text),1):
  missing=[k for k in required if not _clean(row.get(k))]
  if missing:raise HTTPException(422,f"Promotion block {i}: missing {', '.join(missing)}.")
  try:order=int(row.get("order_index","1"))
  except ValueError as e:raise HTTPException(422,f"Promotion block {i}: order_index must be an integer.") from e
  status=_clean(row.get("status","ACTIVE")).upper()
  if status not in{"ACTIVE","INACTIVE"}:raise HTTPException(422,f"Promotion block {i}: status must be ACTIVE or INACTIVE.")
  result.append(PromotionImportRow(i,row["course_code"],row["chapter"],_clean(row.get("topic")) or None,row["platform_name"],_clean(row.get("description")) or None,row["button_text"],row["url"],order,status))
 if not result:raise HTTPException(422,"The Havan promotion file contains no promotion blocks.")
 return result
def preview_university_import(rows:list[UniversityImportRow])->dict:
 seen=set()
 for row in rows:
  key=(row.university_code.upper(),row.curriculum.casefold(),row.curriculum_version.casefold(),row.stream_code.upper(),row.course_code.upper(),row.semester)
  if key in seen:raise HTTPException(422,f"University CSV line {row.line}: duplicate mapping in file.")
  seen.add(key)
 return {"rows":len(rows),"universities":len({r.university_code.upper() for r in rows}),"curriculums":len({(r.university_code.upper(),r.curriculum.casefold(),r.curriculum_version.casefold()) for r in rows}),"streams":len({(r.university_code.upper(),r.curriculum.casefold(),r.curriculum_version.casefold(),r.stream_code.upper()) for r in rows}),"course_mappings":len(rows)}
def commit_university_import(db:Session,rows:list[UniversityImportRow])->dict:
 preview_university_import(rows)
 try:
  universities={};curriculums={};streams={};counts={"universities":0,"curriculums":0,"streams":0,"courses":0,"mappings":0}
  for row in rows:
   ukey=row.university_code.upper();u=universities.get(ukey) or db.scalar(select(University).where(University.code==row.university_code))
   if u is None:u=University(name=row.university_name,code=row.university_code,status="ACTIVE");db.add(u);db.flush();counts["universities"]+=1
   elif u.name.strip().casefold()!=row.university_name.casefold():raise HTTPException(409,f"University code {row.university_code} already belongs to another university.")
   universities[ukey]=u
   ckey=(u.id,row.curriculum.casefold(),row.curriculum_version.casefold());c=curriculums.get(ckey) or db.scalar(select(Curriculum).where(Curriculum.university_id==u.id,Curriculum.name==row.curriculum,Curriculum.version==row.curriculum_version))
   if c is None:c=Curriculum(university_id=u.id,name=row.curriculum,version=row.curriculum_version,academic_year=row.academic_year,status="ACTIVE");db.add(c);db.flush();counts["curriculums"]+=1
   curriculums[ckey]=c
   skey=(c.id,row.stream_code.upper());s=streams.get(skey) or db.scalar(select(Stream).where(Stream.curriculum_id==c.id,Stream.code==row.stream_code))
   if s is None:s=Stream(curriculum_id=c.id,name=row.stream_name,code=row.stream_code,status="ACTIVE");db.add(s);db.flush();counts["streams"]+=1
   elif s.name.strip().casefold()!=row.stream_name.casefold():raise HTTPException(409,f"Stream code {row.stream_code} already belongs to another stream.")
   streams[skey]=s
   course=db.scalar(select(Course).where(Course.code==row.course_code,Course.academic_scope=="FRESHMAN",Course.status=="ACTIVE"))
   if course is None:raise HTTPException(422,f"Course {row.course_code} is not in the Freshman Course Registry. Upload the course content before mapping it to a university.")
   if course.name.strip().casefold()!=row.course_name.casefold():raise HTTPException(409,f"Course {row.course_code} name conflicts with the Freshman Course Registry.")
   if row.credit_hours is not None and course.credit_hours is not None and course.credit_hours!=row.credit_hours:raise HTTPException(409,f"Course {row.course_code} credit hours conflict with the Freshman Course Registry.")
   m=db.scalar(select(UniversityCourseMapping).where(UniversityCourseMapping.stream_id==s.id,UniversityCourseMapping.course_id==course.id))
   if m is None:
    max_order=db.scalar(select(func.max(UniversityCourseMapping.order_index)).where(UniversityCourseMapping.stream_id==s.id,UniversityCourseMapping.semester_number==row.semester)) or 0;db.add(UniversityCourseMapping(curriculum_id=c.id,stream_id=s.id,course_id=course.id,semester_number=row.semester,order_index=max_order+1,status="ACTIVE"));counts["mappings"]+=1
   elif m.semester_number!=row.semester:raise HTTPException(409,f"Course {row.course_code} is already mapped to another semester.")
  db.commit();return counts
 except HTTPException:db.rollback();raise
 except IntegrityError as e:db.rollback();raise HTTPException(409,"The university import conflicts with existing records. No records were saved.") from e
 except Exception as e:db.rollback();raise HTTPException(500,"The university import failed. No records were saved.") from e
def preview_promotion_import(db:Session,rows:list[PromotionImportRow])->dict:
 errors=[]
 for row in rows:
  c=db.scalar(select(Course).where(Course.code==row.course_code,Course.academic_scope=="FRESHMAN"))
  if c is None:errors.append(f"Promotion {row.line}: course {row.course_code} was not found.");continue
  ch=db.scalar(select(Chapter).where(Chapter.course_id==c.id,Chapter.name==row.chapter_name))
  if ch is None:errors.append(f"Promotion {row.line}: chapter '{row.chapter_name}' was not found.")
  elif row.topic_name and db.scalar(select(Topic.id).where(Topic.chapter_id==ch.id,Topic.name==row.topic_name)) is None:errors.append(f"Promotion {row.line}: topic '{row.topic_name}' was not found.")
 if errors:raise HTTPException(422,detail=errors)
 return {"promotions":len(rows)}
def commit_promotion_import(db:Session,rows:list[PromotionImportRow])->dict:
 preview_promotion_import(db,rows)
 try:
  created=updated=0
  for row in rows:
   c=db.scalar(select(Course).where(Course.code==row.course_code,Course.academic_scope=="FRESHMAN"));ch=db.scalar(select(Chapter).where(Chapter.course_id==c.id,Chapter.name==row.chapter_name));topic=db.scalar(select(Topic).where(Topic.chapter_id==ch.id,Topic.name==row.topic_name)) if row.topic_name else None
   stmt=select(HavanPromotion).where(HavanPromotion.topic_id==topic.id if topic else HavanPromotion.chapter_id==ch.id);same=next((p for p in db.scalars(stmt).all() if p.platform_name.casefold()==row.platform_name.casefold() and p.url==row.url),None)
   if same:same.description=row.description;same.button_text=row.button_text;same.order_index=row.order_index;same.status=row.status;updated+=1
   else:db.add(HavanPromotion(chapter_id=None if topic else ch.id,topic_id=topic.id if topic else None,platform_name=row.platform_name,description=row.description,button_text=row.button_text,order_index=row.order_index,url=row.url,status=row.status));created+=1
  db.commit();return {"created":created,"updated":updated}
 except HTTPException:db.rollback();raise
 except IntegrityError as e:db.rollback();raise HTTPException(409,"The Havan promotion import conflicts with existing records. No records were saved.") from e
 except Exception as e:db.rollback();raise HTTPException(500,"The Havan promotion import failed. No records were saved.") from e
