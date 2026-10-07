from __future__ import annotations

import re
from dataclasses import dataclass

from fastapi import HTTPException


BULLET_RE = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+(.*)$")
EXPLICIT_COURSE_RE = re.compile(r"^\s*Course:\s*(.+?)\s*$", re.IGNORECASE)
EXPLICIT_CHAPTER_RE = re.compile(r"^\s*Chapter:\s*(.+?)\s*$", re.IGNORECASE)
EXPLICIT_TOPIC_RE = re.compile(r"^\s*Topic:\s*(.+?)\s*$", re.IGNORECASE)
DIFFICULTY_RE = re.compile(r"^\s*Difficulty:\s*([1-5])\s*$", re.IGNORECASE)
CRITICAL_RE = re.compile(r"^\s*Critical\s+Points:\s*$", re.IGNORECASE)
COURSE_ID_RE = re.compile(r"^\[([^\]]+)\]\s*(.+?)\s*$")
TOPIC_DIFFICULTY_RE = re.compile(r"^(.*?)\s*\[([1-5])\]\s*$")
COURSE_CODE_RE = re.compile(r"^[A-Za-z0-9_. -]+$")
COURSE_FILE_MARKER = "TYPE: COURSE_V1"



@dataclass
class ParsedTopic:
    name: str
    difficulty: int
    important_points: str | None = None


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
    current_topic: ParsedTopic | None = None
    collecting_points = False
    points: list[str] = []

    def flush_points() -> None:
        nonlocal collecting_points, points
        if current_topic is not None and points:
            current_topic.important_points = "\n".join(points)
        collecting_points = False
        points = []

    lines = content.splitlines()
    first_content = next((line.strip() for line in lines if line.strip()), "")
    if first_content.upper() == COURSE_FILE_MARKER:
        lines = lines[lines.index(next(line for line in lines if line.strip())) + 1:]

    for line_number, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()
        if not line:
            continue

        if collecting_points:
            bullet_match = BULLET_RE.match(line)
            if bullet_match:
                points.append(bullet_match.group(1).strip())
                continue
            flush_points()

        course_match = EXPLICIT_COURSE_RE.match(line)
        if course_match:
            code, name = _course_identity(course_match.group(1), line_number)
            current_course = ParsedCourse(name=name, code=code, chapters=[])
            parsed.append(current_course)
            current_chapter = None
            current_topic = None
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
            current_topic = None
            continue

        topic_match = EXPLICIT_TOPIC_RE.match(line)
        if topic_match:
            if current_chapter is None:
                raise HTTPException(status_code=422, detail=f"Line {line_number}: Topic appears before a Chapter.")
            name = topic_match.group(1).strip()
            if not name:
                raise HTTPException(status_code=422, detail=f"Line {line_number}: topic name is empty.")
            if len(name) > 250:
                raise HTTPException(status_code=422, detail=f"Line {line_number}: topic name is too long.")
            current_topic = ParsedTopic(name=name, difficulty=3)
            current_chapter.topics.append(current_topic)
            continue

        difficulty_match = DIFFICULTY_RE.match(line)
        if difficulty_match:
            if current_topic is None:
                raise HTTPException(status_code=422, detail=f"Line {line_number}: Difficulty appears before a Topic.")
            current_topic.difficulty = int(difficulty_match.group(1))
            continue

        if CRITICAL_RE.match(line):
            if current_topic is None:
                raise HTTPException(status_code=422, detail=f"Line {line_number}: Critical Points appears before a Topic.")
            collecting_points = True
            points = []
            continue

        bullet_match = BULLET_RE.match(line)
        if bullet_match:
            if current_chapter is None:
                raise HTTPException(status_code=422, detail=f"Line {line_number}: topic appears before a Chapter.")
            name, difficulty = _topic_name_and_difficulty(bullet_match.group(1), line_number)
            current_topic = ParsedTopic(name=name, difficulty=difficulty)
            current_chapter.topics.append(current_topic)
            continue

        raise HTTPException(
            status_code=422,
            detail=f"Line {line_number}: expected 'Course: [CODE] Name', 'Chapter: Name', 'Topic: Name', 'Difficulty: 1-5', 'Critical Points:', or a topic bullet.",
        )

    flush_points()
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
            detail=f"Line {line_number}: course code must be 1-40 characters using letters, numbers, spaces, '.', '_' or '-'.",
        )
    if not name:
        raise HTTPException(status_code=422, detail=f"Line {line_number}: course name is empty.")
    if len(name) > 150:
        raise HTTPException(status_code=422, detail=f"Line {line_number}: course name is too long.")
    return code, name


def _topic_name_and_difficulty(text: str, line_number: int) -> tuple[str, int]:
    match = TOPIC_DIFFICULTY_RE.match(text.strip())
    if not match:
        raise HTTPException(
            status_code=422,
            detail=f"Line {line_number}: every topic bullet must end with a difficulty [1] to [5].",
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
