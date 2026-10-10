from __future__ import annotations

import csv, io, re
from urllib.parse import urlparse, urlunparse
from dataclasses import dataclass
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db.models.academic_catalog import (
    Chapter,
    Course,
    HavanPromotion,
    Stream,
    Topic,
    University,
    UniversityCourseMapping,
    UniversityCourseOffering,
)

MAX_FILE_SIZE=5*1024*1024
PROMOTION_FILE_MARKER="TYPE: HAVAN_PROMOTION_V1"
CSV_COLUMN_ORDER=("university_code","university_name","stream_code","stream_name","semester","course_code","course_name","credit_hours")
@dataclass
class UniversityImportRow:
 line:int; university_code:str; university_name:str; stream_code:str; stream_name:str; semester:int; course_code:str; course_name:str; credit_hours:int|None
@dataclass
class PromotionImportRow:
 line:int; course_code:str; chapter_name:str; topic_name:str|None; platform_name:str; description:str|None; button_text:str; url:str; order_index:int; status:str
def _clean(v:str|None)->str:return(v or "").strip()
def _matching_freshman_course(courses:list[Course],name:str,credit_hours:int|None,active_only:bool=True)->Course|None:
 for course in courses:
  if active_only and course.status!="ACTIVE":continue
  if course.name.strip().casefold()!=name.strip().casefold():continue
  if credit_hours is not None and course.credit_hours is not None and course.credit_hours!=credit_hours:continue
  return course
 return None
def parse_university_csv(raw:bytes)->list[UniversityImportRow]:
 try:text=raw.decode("utf-8-sig")
 except UnicodeDecodeError as e:raise HTTPException(422,"The university CSV must be UTF-8 text.") from e
 reader=csv.DictReader(io.StringIO(text)); headers=tuple(_clean(h).lower() for h in(reader.fieldnames or []))
 if headers!=CSV_COLUMN_ORDER:raise HTTPException(422,"University CSV header must be exactly: "+",".join(CSV_COLUMN_ORDER))
 rows=[]
 for line,raw_row in enumerate(reader,2):
  if None in raw_row or any(value is None for value in raw_row.values()):raise HTTPException(422,f"University CSV line {line}: row has a different number of columns than the header.")
  row={str(k).strip().lower():_clean(v) for k,v in raw_row.items() if k is not None}; required=["university_code","university_name","stream_code","stream_name","semester","course_code","course_name"]
  if any(not row.get(k) for k in required):raise HTTPException(422,f"University CSV line {line}: required value is missing.")
  limits={"university_code":30,"university_name":150,"stream_code":30,"stream_name":100,"course_code":40,"course_name":150}
  for key,maximum in limits.items():
   if len(row[key])>maximum:raise HTTPException(422,f"University CSV line {line}: {key} must be {maximum} characters or fewer.")
  if not re.fullmatch(r"[A-Za-z0-9_-]+",row["university_code"]):raise HTTPException(422,f"University CSV line {line}: university_code may contain only letters, digits, underscores, and hyphens.")
  if not re.fullmatch(r"[A-Za-z0-9_-]+",row["stream_code"]):raise HTTPException(422,f"University CSV line {line}: stream_code may contain only letters, digits, underscores, and hyphens.")
  if not re.fullmatch(r"[A-Za-z0-9 ._-]+",row["course_code"]):raise HTTPException(422,f"University CSV line {line}: course_code contains unsupported characters.")
  try:semester=int(row["semester"])
  except ValueError as e:raise HTTPException(422,f"University CSV line {line}: semester must be 1 or 2.") from e
  if semester not in(1,2):raise HTTPException(422,f"University CSV line {line}: semester must be 1 or 2.")
  credit=None
  if row.get("credit_hours"):
   try:credit=int(row["credit_hours"])
   except ValueError as e:raise HTTPException(422,f"University CSV line {line}: credit_hours must be an integer.") from e
   if not 0<=credit<=30:raise HTTPException(422,f"University CSV line {line}: credit_hours must be between 0 and 30.")
  rows.append(UniversityImportRow(line,row["university_code"],row["university_name"],row["stream_code"],row["stream_name"],semester,row["course_code"],row["course_name"],credit))
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
 lines=text.replace("\r\n","\n").replace("\r","\n").splitlines()
 marker_index=next((index for index,line in enumerate(lines) if line.strip()),None)
 if marker_index is None or lines[marker_index].strip().upper()!=PROMOTION_FILE_MARKER:
  raise HTTPException(422,"The Havan promotion file must start with TYPE: HAVAN_PROMOTION_V1.")
 blocks=_promotion_blocks("\n".join(lines[marker_index+1:]))
 if not blocks:raise HTTPException(422,"The Havan promotion file contains no promotion blocks.")
 for i,row in enumerate(blocks,1):
  missing=[k for k in required if not _clean(row.get(k))]
  if missing:raise HTTPException(422,f"Promotion block {i}: missing {', '.join(missing)}.")
  try:order=int(row.get("order_index","1"))
  except ValueError as e:raise HTTPException(422,f"Promotion block {i}: order_index must be an integer.") from e
  status=_clean(row.get("status","ACTIVE")).upper()
  if status not in{"ACTIVE","INACTIVE"}:raise HTTPException(422,f"Promotion block {i}: status must be ACTIVE or INACTIVE.")
  parsed_url=urlparse(row["url"].strip())
  if parsed_url.scheme.lower() not in {"http","https"} or not parsed_url.netloc: raise HTTPException(422,f"Promotion block {i}: url must be a valid http or https URL.")
  normalized_url=urlunparse((parsed_url.scheme.lower(),parsed_url.netloc.lower(),re.sub(r"/{2,}","/",parsed_url.path or "/"),parsed_url.params,parsed_url.query,parsed_url.fragment))
  result.append(PromotionImportRow(i,row["course_code"],row["chapter"],_clean(row.get("topic")) or None,row["platform_name"],_clean(row.get("description")) or None,row["button_text"],normalized_url,order,status))
 return result
def _batched_scalars(db:Session,values:set,statement_for_values,batch_size:int=400)->list:
 values=sorted(values)
 result=[]
 for start in range(0,len(values),batch_size):result.extend(db.scalars(statement_for_values(values[start:start+batch_size])).all())
 return result

def _load_university_import_state(db:Session,rows:list[UniversityImportRow])->dict:
 university_codes={row.university_code.strip().upper() for row in rows}
 stream_codes={row.stream_code.strip().upper() for row in rows}
 course_codes={row.course_code.strip().upper() for row in rows}
 universities={item.code.strip().upper():item for item in _batched_scalars(db,university_codes,lambda part:select(University).where(func.upper(University.code).in_(part)))}
 university_ids={item.id for item in universities.values()}
 streams={}
 for item in _batched_scalars(db,university_ids,lambda part:select(Stream).where(Stream.university_id.in_(part))):
  if item.code.strip().upper() in stream_codes:streams[(item.university_id,item.code.strip().upper())]=item
 registry_keys={f"UNIVERSITY:{row.university_code.strip().upper()}:{row.stream_code.strip().upper()}:{row.course_code.strip().upper()}" for row in rows}
 courses_by_registry={item.registry_key:item for item in _batched_scalars(db,registry_keys,lambda part:select(Course).where(Course.registry_key.in_(part)))}
 freshman_by_code={}
 for item in _batched_scalars(db,course_codes,lambda part:select(Course).where(Course.academic_scope=="FRESHMAN",func.upper(Course.code).in_(part))):
  freshman_by_code.setdefault(item.code.strip().upper(),[]).append(item)
 stream_ids={item.id for item in streams.values()}
 offerings={}
 legacy_mappings={}
 active_by_stream={}
 max_order={}
 for stream_part in [list(stream_ids)[start:start+400] for start in range(0,len(stream_ids),400)]:
  found_offerings=db.scalars(select(UniversityCourseOffering).where(UniversityCourseOffering.stream_id.in_(stream_part))).all()
  for item in found_offerings:
   offerings[(item.stream_id,item.course_id)]=item
   if item.status!="ARCHIVED":active_by_stream.setdefault(item.stream_id,[]).append(item)
  found_mappings=db.scalars(select(UniversityCourseMapping).where(UniversityCourseMapping.stream_id.in_(stream_part))).all()
  legacy_mappings.update({(item.stream_id,item.course_id):item for item in found_mappings})
  for stream_id,semester,max_index in db.execute(select(UniversityCourseOffering.stream_id,UniversityCourseOffering.semester_number,func.max(UniversityCourseOffering.order_index)).where(UniversityCourseOffering.stream_id.in_(stream_part),UniversityCourseOffering.status!="ARCHIVED").group_by(UniversityCourseOffering.stream_id,UniversityCourseOffering.semester_number)):
   max_order[(stream_id,semester)]=max_index or 0
 return {"universities":universities,"streams":streams,"courses":courses_by_registry,"freshman":freshman_by_code,"offerings":offerings,"legacy_mappings":legacy_mappings,"active_by_stream":active_by_stream,"max_order":max_order}

def _validate_university_references(db:Session,rows:list[UniversityImportRow],state:dict|None=None)->dict:
 state=state or _load_university_import_state(db,rows)
 for row in rows:
  university=state["universities"].get(row.university_code.strip().upper())
  if university is not None and university.name.strip().casefold()!=row.university_name.strip().casefold(): raise HTTPException(409,f"University code {row.university_code} already belongs to another university.")
  if university is None: continue
  stream=state["streams"].get((university.id,row.stream_code.strip().upper()))
  if stream is not None and stream.name.strip().casefold()!=row.stream_name.strip().casefold(): raise HTTPException(409,f"University CSV line {row.line}: stream code {row.stream_code} already belongs to another stream.")
  if stream is None: continue
  course_code=row.course_code.strip().upper()
  registry_key=f"UNIVERSITY:{university.code.upper()}:{stream.code.upper()}:{course_code}"
  course=state["courses"].get(registry_key)
  if course is not None and course.status!="ACTIVE":course=None
  if course is None:
   # Reuse a national freshman course only when its catalog identity matches.
   # Universities may legitimately reuse a code for a different local course.
   course=_matching_freshman_course(state["freshman"].get(course_code,[]),row.course_name,row.credit_hours)
  if course is None: continue
  offering=state["offerings"].get((stream.id,course.id))
  legacy_mapping=state["legacy_mappings"].get((stream.id,course.id))
  if offering is not None and offering.status!="ARCHIVED" and offering.semester_number!=row.semester: raise HTTPException(409,f"University CSV line {row.line}: course {row.course_code} is already offered in semester {offering.semester_number}.")
  if offering is None and legacy_mapping is not None and legacy_mapping.status!="ARCHIVED" and legacy_mapping.semester_number!=row.semester: raise HTTPException(409,f"University CSV line {row.line}: course {row.course_code} is already mapped to semester {legacy_mapping.semester_number}.")
 return state

def preview_university_import(rows:list[UniversityImportRow],db:Session|None=None)->dict:
 seen=set(); course_semesters={}; university_names={}; stream_names={}
 for row in rows:
  university_key=row.university_code.strip().upper(); stream_key=(university_key,row.stream_code.strip().upper())
  prior_university_name=university_names.setdefault(university_key,row.university_name.strip().casefold())
  if prior_university_name!=row.university_name.strip().casefold():raise HTTPException(422,f"University CSV line {row.line}: one university_code cannot have multiple university names.")
  prior_stream_name=stream_names.setdefault(stream_key,row.stream_name.strip().casefold())
  if prior_stream_name!=row.stream_name.strip().casefold():raise HTTPException(422,f"University CSV line {row.line}: one stream_code cannot have multiple names within a university.")
  course_key=(row.university_code.strip().upper(),row.stream_code.strip().upper(),row.course_code.strip().upper())
  exact_key=course_key+(row.semester,)
  if exact_key in seen:
   raise HTTPException(422,f"University CSV line {row.line}: duplicate course mapping in file.")
  seen.add(exact_key)
  previous=course_semesters.get(course_key)
  if previous is not None and previous!=row.semester:
   raise HTTPException(422,f"University CSV lines contain course {row.course_code} in both semesters for the same stream.")
  course_semesters[course_key]=row.semester
 if db is not None: _validate_university_references(db,rows)
 return {"rows":len(rows),"universities":len({r.university_code.strip().upper() for r in rows}),"streams":len({(r.university_code.strip().upper(),r.stream_code.strip().upper()) for r in rows}),"course_mappings":len(rows),"course_offerings":len(rows)}

def commit_university_import(db:Session,rows:list[UniversityImportRow])->dict:
 preview_university_import(rows)
 try:
  state=_validate_university_references(db,rows)
  universities=state["universities"];streams=state["streams"];courses=state["courses"]
  counts={"universities":0,"streams":0,"courses":0,"offerings":0,"archived_offerings":0,"reactivated_offerings":0}
  for row in rows:
   key=row.university_code.strip().upper()
   if key not in universities:
    universities[key]=University(name=row.university_name.strip(),code=key,status="ACTIVE");db.add(universities[key]);counts["universities"]+=1
  db.flush()
  for row in rows:
   university=universities[row.university_code.strip().upper()]
   key=(university.id,row.stream_code.strip().upper())
   if key not in streams:
    streams[key]=Stream(university_id=university.id,name=row.stream_name.strip(),code=key[1],status="ACTIVE");db.add(streams[key]);counts["streams"]+=1
  db.flush()
  for row in rows:
   university=universities[row.university_code.strip().upper()]
   stream=streams[(university.id,row.stream_code.strip().upper())]
   course_code=row.course_code.strip().upper()
   registry_key=f"UNIVERSITY:{university.code.upper()}:{stream.code.upper()}:{course_code}"
   course=courses.get(registry_key)
   if course is None:
    course=_matching_freshman_course(state["freshman"].get(course_code,[]),row.course_name,row.credit_hours,active_only=False)
   if course is None:
    course=Course(stream_id=stream.id,code=course_code,name=row.course_name.strip(),credit_hours=row.credit_hours,academic_scope="UNIVERSITY",registry_key=registry_key,status="ACTIVE")
    db.add(course);counts["courses"]+=1
   elif course.name.strip().casefold()!=row.course_name.strip().casefold():
    raise HTTPException(409,f"Course {row.course_code} already has a different name.")
   elif row.credit_hours is not None and course.credit_hours is not None and course.credit_hours!=row.credit_hours:
    raise HTTPException(409,f"Course {row.course_code} already has different credit hours.")
   courses[registry_key]=course
  db.flush()

  incoming_by_stream={}
  for row in rows:
   university=universities[row.university_code.strip().upper()]
   stream=streams[(university.id,row.stream_code.strip().upper())]
   course_code=row.course_code.strip().upper()
   registry_key=f"UNIVERSITY:{university.code.upper()}:{stream.code.upper()}:{course_code}"
   course=courses.get(registry_key) or _matching_freshman_course(state["freshman"].get(course_code,[]),row.course_name,row.credit_hours,active_only=False)
   incoming_by_stream.setdefault(stream.id,set()).add(course.id)
   key=(stream.id,course.id)
   offering=state["offerings"].get(key)
   if offering is None:
    order_key=(stream.id,row.semester)
    order=state["max_order"].get(order_key,0)+1
    state["max_order"][order_key]=order
    offering=UniversityCourseOffering(stream_id=stream.id,course_id=course.id,semester_number=row.semester,order_index=order,status="ACTIVE")
    db.add(offering);state["offerings"][key]=offering;counts["offerings"]+=1
   else:
    if offering.semester_number!=row.semester:raise HTTPException(409,f"Course {row.course_code} is already offered in another semester.")
    if offering.status=="ARCHIVED":offering.status="ACTIVE";counts["reactivated_offerings"]+=1

  for stream_id,course_ids in incoming_by_stream.items():
   for offering in state["active_by_stream"].get(stream_id,[]):
    if offering.course_id not in course_ids:
     offering.status="ARCHIVED";counts["archived_offerings"]+=1

  # Keep the existing import response fields for clients that still call these
  # rows mappings, while exposing the canonical offering counts as well.
  counts["mappings"] = counts["offerings"]
  counts["archived_mappings"] = counts["archived_offerings"]
  counts["reactivated_mappings"] = counts["reactivated_offerings"]
  db.commit();return counts
 except HTTPException:db.rollback();raise
 except IntegrityError as e:db.rollback();raise HTTPException(409,"The university import conflicts with existing records. No records were saved.") from e
 except Exception as e:db.rollback();raise HTTPException(500,"The university import failed. No records were saved.") from e

def _load_promotion_import_state(db:Session,rows:list[PromotionImportRow])->dict:
 course_codes={row.course_code.strip().upper() for row in rows}
 courses={}
 for item in _batched_scalars(db,course_codes,lambda part:select(Course).where(Course.academic_scope=="FRESHMAN",Course.status=="ACTIVE",func.upper(Course.code).in_(part))):
  courses.setdefault(item.code.strip().upper(),item)
 course_ids={item.id for item in courses.values()}
 chapters_by_course_name={}
 for item in _batched_scalars(db,course_ids,lambda part:select(Chapter).where(Chapter.course_id.in_(part))):
  chapters_by_course_name[(item.course_id,item.name.strip().casefold())]=item
 chapter_ids={chapter.id for chapter in chapters_by_course_name.values()}
 topics_by_chapter_name={}
 for item in _batched_scalars(db,chapter_ids,lambda part:select(Topic).where(Topic.chapter_id.in_(part))):
  topics_by_chapter_name[(item.chapter_id,item.name.strip().casefold())]=item
 errors=[];targets={};seen=set();chapter_ids_for_promos=set();topic_ids_for_promos=set()
 for row in rows:
  course=courses.get(row.course_code.strip().upper())
  if course is None:errors.append(f"Promotion {row.line}: course {row.course_code} was not found.");continue
  chapter=chapters_by_course_name.get((course.id,row.chapter_name.strip().casefold()))
  if chapter is None:errors.append(f"Promotion {row.line}: chapter '{row.chapter_name}' was not found.");continue
  topic=topics_by_chapter_name.get((chapter.id,(row.topic_name or "").strip().casefold())) if row.topic_name else None
  if row.topic_name and topic is None:errors.append(f"Promotion {row.line}: topic '{row.topic_name}' was not found.");continue
  key=(row.course_code.strip().upper(),row.chapter_name.strip().casefold(),(row.topic_name or "").strip().casefold(),row.platform_name.strip().casefold(),row.url.strip())
  if key in seen:raise HTTPException(422,f"Promotion block {row.line}: duplicate promotion target in the uploaded file.")
  seen.add(key);targets[row.line]=(course,chapter,topic)
  if topic is not None:topic_ids_for_promos.add(topic.id)
  else:chapter_ids_for_promos.add(chapter.id)
 if errors:raise HTTPException(422,detail=errors)
 promotions=[]
 promotions.extend(_batched_scalars(db,chapter_ids_for_promos,lambda part:select(HavanPromotion).where(HavanPromotion.chapter_id.in_(part))))
 promotions.extend(_batched_scalars(db,topic_ids_for_promos,lambda part:select(HavanPromotion).where(HavanPromotion.topic_id.in_(part))))
 existing={(item.chapter_id,item.topic_id,item.platform_name.strip().casefold(),item.url):item for item in promotions}
 return {"targets":targets,"existing":existing}

def preview_promotion_import(db:Session,rows:list[PromotionImportRow])->dict:
 _load_promotion_import_state(db,rows)
 return {"promotions":len(rows)}
def commit_promotion_import(db:Session,rows:list[PromotionImportRow])->dict:
 try:
  state=_load_promotion_import_state(db,rows)
  created=updated=0
  for row in rows:
   c,ch,topic=state["targets"][row.line]
   same=state["existing"].get((None if topic else ch.id,topic.id if topic else None,row.platform_name.strip().casefold(),row.url))
   if same:same.description=row.description;same.button_text=row.button_text;same.order_index=row.order_index;same.status=row.status;updated+=1
   else:
    item=HavanPromotion(chapter_id=None if topic else ch.id,topic_id=topic.id if topic else None,platform_name=row.platform_name,description=row.description,button_text=row.button_text,order_index=row.order_index,url=row.url,status=row.status)
    db.add(item);state["existing"][(item.chapter_id,item.topic_id,row.platform_name.strip().casefold(),row.url)]=item;created+=1
  db.commit();return {"created":created,"updated":updated}
 except HTTPException:db.rollback();raise
 except IntegrityError as e:db.rollback();raise HTTPException(409,"The Havan promotion import conflicts with existing records. No records were saved.") from e
 except Exception as e:db.rollback();raise HTTPException(500,"The Havan promotion import failed. No records were saved.") from e
