from __future__ import annotations

import re
from dataclasses import dataclass

from fastapi import HTTPException


BULLET_RE = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+(.*)$")
EXPLICIT_COURSE_RE = re.compile(r"^\s*Course:\s*(.+?)\s*$", re.IGNORECASE)
EXPLICIT_CHAPTER_RE = re.compile(r"^\s*Chapter:\s*(.+?)\s*$", re.IGNORECASE)
COURSE_ID_RE = re.compile(r"^\[([^\]]+)\]\s*(.+?)\s*$")
DIFFICULTY_RE = re.compile(r"^(.*?)\s*\[([1-5])\]\s*$")
COURSE_CODE_RE = re.compile(r"^[A-Za-z0-9_. -]+$")


@dataclass
class ParsedTopic:
    name: str
    difficulty: int


@dataclass
class ParsedChapter:
    name: str
    topics: list[ParsedTopic]


@dataclass
class ParsedCourse:
    name: str
    code: str
    chapters: list[ParsedChapter]


def parse_bullet_curriculum(content: str) -> list[ParsedCourse]:
    parsed: list[ParsedCourse] = []
    current_course: ParsedCourse | None = None
    current_chapter: ParsedChapter | None = None

    for line_number, raw_line in enumerate(content.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue

        course_match = EXPLICIT_COURSE_RE.match(line)
        if course_match:
            code, name = _course_identity(course_match.group(1), line_number)
            current_course = ParsedCourse(name=name, code=code, chapters=[])
            parsed.append(current_course)
            current_chapter = None
            continue

        chapter_match = EXPLICIT_CHAPTER_RE.match(line)
        if chapter_match:
            if current_course is None:
                raise HTTPException(status_code=422, detail=f"Line {line_number}: Chapter appears before a Course.")
            name = chapter_match.group(1).strip()
            if not name:
                raise HTTPException(status_code=422, detail=f"Line {line_number}: chapter name is empty.")
            if len(name) > 200:
                raise HTTPException(status_code=422, detail=f"Line {line_number}: chapter name is too long.")
            current_chapter = ParsedChapter(name=name, topics=[])
            current_course.chapters.append(current_chapter)
            continue

        bullet_match = BULLET_RE.match(line)
        if bullet_match:
            if current_chapter is None:
                raise HTTPException(status_code=422, detail=f"Line {line_number}: topic appears before a Chapter.")
            name, difficulty = _topic_name_and_difficulty(bullet_match.group(1), line_number)
            current_chapter.topics.append(ParsedTopic(name=name, difficulty=difficulty))
            continue

        raise HTTPException(
            status_code=422,
            detail=f"Line {line_number}: expected 'Course: [CODE] Name', 'Chapter: Name', or a topic bullet.",
        )

    return _validate_parsed(parsed)


def _course_identity(text: str, line_number: int) -> tuple[str, str]:
    match = COURSE_ID_RE.match(text.strip())
    if not match:
        raise HTTPException(status_code=422, detail=f"Line {line_number}: course must use the canonical format 'Course: [CODE] Name'.")
    code, name = match.group(1).strip(), match.group(2).strip()
    if not code:
        raise HTTPException(status_code=422, detail=f"Line {line_number}: course code is empty.")
    if len(code) > 40 or not COURSE_CODE_RE.fullmatch(code):
        raise HTTPException(
            status_code=422,
            detail=f"Line {line_number}: course code must be 1–40 characters using letters, numbers, spaces, '.', '_' or '-'.",
        )
    if not name:
        raise HTTPException(status_code=422, detail=f"Line {line_number}: course name is empty.")
    if len(name) > 150:
        raise HTTPException(status_code=422, detail=f"Line {line_number}: course name is too long.")
    return code, name


def _topic_name_and_difficulty(text: str, line_number: int) -> tuple[str, int]:
    match = DIFFICULTY_RE.match(text.strip())
    if not match:
        raise HTTPException(
            status_code=422,
            detail=f"Line {line_number}: every topic must end with a difficulty [1] to [5].",
        )
    name = match.group(1).strip()
    if not name:
        raise HTTPException(status_code=422, detail=f"Line {line_number}: topic name is empty.")
    if len(name) > 250:
        raise HTTPException(status_code=422, detail=f"Line {line_number}: topic name is too long.")
    return name, int(match.group(2))


def _validate_parsed(parsed: list[ParsedCourse]) -> list[ParsedCourse]:
    if not parsed:
        raise HTTPException(status_code=422, detail="The uploaded file contains no curriculum items.")

    seen_codes: set[str] = set()
    for course in parsed:
        code_key = course.code.casefold()
        if code_key in seen_codes:
            raise HTTPException(status_code=422, detail=f"Duplicate course code '{course.code}' in the uploaded file.")
        seen_codes.add(code_key)

        if not course.chapters:
            raise HTTPException(status_code=422, detail=f"Course '{course.name}' has no chapters.")

        seen_chapters: set[str] = set()
        for chapter in course.chapters:
            chapter_key = chapter.name.casefold()
            if chapter_key in seen_chapters:
                raise HTTPException(status_code=422, detail=f"Course '{course.name}' contains duplicate chapter '{chapter.name}'.")
            seen_chapters.add(chapter_key)

            if not chapter.topics:
                raise HTTPException(status_code=422, detail=f"Chapter '{chapter.name}' in course '{course.name}' has no topics.")

            seen_topics: set[str] = set()
            for topic in chapter.topics:
                topic_key = topic.name.casefold()
                if topic_key in seen_topics:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Chapter '{chapter.name}' in course '{course.name}' contains duplicate topic '{topic.name}'.",
                    )
                seen_topics.add(topic_key)

    return parsed
