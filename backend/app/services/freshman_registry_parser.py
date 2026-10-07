from __future__ import annotations
import re
from dataclasses import dataclass
from fastapi import HTTPException
BULLET_RE=re.compile(r"^\\s*(?:[-*•]|\\d+[.)])\\s+(.*)$")
COURSE_RE=re.compile(r"^\\s*Course:\\s*(.+?)\\s*$",re.I); CHAPTER_RE=re.compile(r"^\\s*Chapter:\\s*(.+?)\\s*$",re.I); TOPIC_RE=re.compile(r"^\\s*Topic:\\s*(.+?)\\s*$",re.I); DIFFICULTY_RE=re.compile(r"^\\s*Difficulty:\\s*([1-5])\\s*$",re.I); CRITICAL_RE=re.compile(r"^\\s*Critical\\s+Points:\\s*$",re.I); COURSE_ID_RE=re.compile(r"^\\[([^\\]]+)\\]\\s*(.+?)\\s*$"); CODE_RE=re.compile(r"^[A-Za-z0-9_. -]+$")
@dataclass
class ParsedTopic: name:str; difficulty:int; important_points:str|None=None
@dataclass
class ParsedChapter: name:str; topics:list[ParsedTopic]
@dataclass
class ParsedCourse: name:str; code:str; chapters:list[ParsedChapter]
def parse_bullet_curriculum(content:str)->list[ParsedCourse]:
 parsed=[]; course=chapter=topic=None; collecting=False; points=[]
 def flush():
  nonlocal collecting,points
  if topic is not None and points: topic.important_points="\\n".join(points)
  collecting=False; points.clear()
 for n,raw in enumerate(content.splitlines(),1):
  line=raw.strip()
  if not line: continue
  if collecting:
   m=BULLET_RE.match(line)
   if m: points.append(m.group(1).strip()); continue
   flush()
  m=COURSE_RE.match(line)
  if m:
   x=COURSE_ID_RE.match(m.group(1).strip())
   if not x or not x.group(1).strip() or not CODE_RE.fullmatch(x.group(1).strip()): raise HTTPException(422,f"Line {n}: invalid course identity.")
   course=ParsedCourse(x.group(2).strip(),x.group(1).strip(),[]); parsed.append(course); chapter=topic=None; continue
  m=CHAPTER_RE.match(line)
  if m:
   if course is None: raise HTTPException(422,f"Line {n}: Chapter appears before a Course.")
   chapter=ParsedChapter(m.group(1).strip(),[]); course.chapters.append(chapter); topic=None; continue
  m=TOPIC_RE.match(line)
  if m:
   if chapter is None: raise HTTPException(422,f"Line {n}: Topic appears before a Chapter.")
   topic=ParsedTopic(m.group(1).strip(),3); chapter.topics.append(topic); continue
  m=DIFFICULTY_RE.match(line)
  if m:
   if topic is None: raise HTTPException(422,f"Line {n}: Difficulty appears before a Topic.")
   topic.difficulty=int(m.group(1)); continue
  if CRITICAL_RE.match(line):
   if topic is None: raise HTTPException(422,f"Line {n}: Critical Points appears before a Topic.")
   collecting=True; points=[]; continue
  if BULLET_RE.match(line) and chapter is not None:
   m=re.match(r"^(.*?)\\s*\\[([1-5])\\]\\s*$",BULLET_RE.match(line).group(1).strip())
   if not m: raise HTTPException(422,f"Line {n}: invalid topic bullet.")
   topic=ParsedTopic(m.group(1).strip(),int(m.group(2))); chapter.topics.append(topic); continue
  raise HTTPException(422,f"Line {n}: unrecognised import line.")
 flush()
 if not parsed: raise HTTPException(422,"The uploaded file contains no course content.")
 for c in parsed:
  if not c.chapters: raise HTTPException(422,f"Course '{c.name}' has no chapters.")
  for ch in c.chapters:
   if not ch.topics: raise HTTPException(422,f"Chapter '{ch.name}' in course '{c.name}' has no topics.")
 return parsed
