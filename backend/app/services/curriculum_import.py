from __future__ import annotations

import re
from dataclasses import dataclass

from fastapi import HTTPException


BULLET_RE = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+(.*)$")
EXPLICIT_COURSE_RE = re.compile(r"^\s*Course:\s*(.+?)\s*$", re.IGNORECASE)
EXPLICIT_CHAPTER_RE = re.compile(r"^\s*Chapter:\s*(.+?)\s*$", re.IGNORECASE)
UNIVERSITY_RE = re.compile(r"^\s*University:\s*(.+?)\s*$", re.IGNORECASE)
CURRICULUM_RE = re.compile(r"^\s*Curriculum:\s*(.+?)\s*$", re.IGNORECASE)
STREAM_RE = re.compile(r"^\s*Stream:\s*(.+?)\s*$", re.IGNORECASE)
VERSION_RE = re.compile(r"^\s*(?:Version|Curriculum Version):\s*(.+?)\s*$", re.IGNORECASE)
ACADEMIC_YEAR_RE = re.compile(r"^\s*Academic Year:\s*(.+?)\s*$", re.IGNORECASE)
DIFFICULTY_RE = re.compile(r"^(.*?)\s*\[([1-5])\]\s*$")


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
    return name, int(match.group(2))


def _parse_explicit_format(content: str) -> list[ParsedCourse]:
    parsed: list[ParsedCourse] = []
    current_course: ParsedCourse | None = None
    current_chapter: ParsedChapter | None = None

    for line_number, raw_line in enumerate(content.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue

        course_match = EXPLICIT_COURSE_RE.match(line)
        if course_match:
            text = course_match.group(1).strip()
            current_course = ParsedCourse(
                name=_course_name(text),
                code=_course_code(text),
                chapters=[],
            )
            parsed.append(current_course)
            current_chapter = None
            continue

        chapter_match = EXPLICIT_CHAPTER_RE.match(line)
        if chapter_match:
            if current_course is None:
                raise HTTPException(status_code=422, detail=f"Line {line_number}: Chapter appears before a Course.")
            current_chapter = ParsedChapter(name=chapter_match.group(1).strip(), topics=[])
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
            detail=f"Line {line_number}: expected 'Course:', 'Chapter:', or a topic bullet.",
        )

    return _validate_parsed(parsed)


def _line_info(line: str, line_number: int) -> tuple[int, str] | None:
    if not line.strip():
        return None
    match = BULLET_RE.match(line)
    if not match:
        raise HTTPException(
            status_code=422,
            detail=f"Line {line_number}: expected a bullet item such as '• Course'.",
        )
    prefix = line[: match.start(1)]
    expanded = prefix.expandtabs(2)
    indent = len(expanded) - len(expanded.lstrip(" "))
    text = match.group(1).strip()
    if not text:
        raise HTTPException(status_code=422, detail=f"Line {line_number}: bullet text is empty.")
    return indent, text


def _parse_legacy_bullets(content: str) -> list[ParsedCourse]:
    parsed: list[ParsedCourse] = []
    current_course: ParsedCourse | None = None
    current_chapter: ParsedChapter | None = None
    course_indent: int | None = None
    chapter_indent: int | None = None

    for line_number, raw_line in enumerate(content.splitlines(), start=1):
        info = _line_info(raw_line, line_number)
        if info is None:
            continue
        indent, text = info

        if current_course is None:
            current_course = ParsedCourse(name=_course_name(text), code=_course_code(text), chapters=[])
            parsed.append(current_course)
            course_indent = indent
            chapter_indent = None
            continue

        if indent <= course_indent:
            current_course = ParsedCourse(name=_course_name(text), code=_course_code(text), chapters=[])
            parsed.append(current_course)
            current_chapter = None
            chapter_indent = None
            continue

        if current_chapter is None or indent <= chapter_indent:
            current_chapter = ParsedChapter(name=text, topics=[])
            current_course.chapters.append(current_chapter)
            chapter_indent = indent
            continue

        name, difficulty = _topic_name_and_difficulty(text, line_number)
        current_chapter.topics.append(ParsedTopic(name=name, difficulty=difficulty))

    return _validate_parsed(parsed)



def parse_full_structure(content: str) -> dict:
    """Parse University -> Curriculum -> Stream -> Course -> Chapter -> Topic."""
    university_name = curriculum_name = curriculum_version = None
    university_code = stream_name = stream_code = None
    academic_year = None
    courses: list[ParsedCourse] = []
    current_course: ParsedCourse | None = None
    current_chapter: ParsedChapter | None = None

    for number, raw_line in enumerate(content.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue

        match = UNIVERSITY_RE.match(line)
        if match:
            university_name = match.group(1).strip()
            continue
        match = CURRICULUM_RE.match(line)
        if match:
            curriculum_name = match.group(1).strip()
            continue
        match = VERSION_RE.match(line)
        if match:
            curriculum_version = match.group(1).strip()
            continue
        match = ACADEMIC_YEAR_RE.match(line)
        if match:
            academic_year = match.group(1).strip()
            continue
        if line.lower().startswith("university code:"):
            university_code = line.split(":", 1)[1].strip()
            continue
        match = STREAM_RE.match(line)
        if match:
            stream_text = match.group(1).strip()
            stream_code = _course_code(stream_text)
            stream_name = _course_name(stream_text)
            continue
        if line.lower().startswith("stream code:"):
            stream_code = line.split(":", 1)[1].strip()
            continue

        course_match = EXPLICIT_COURSE_RE.match(line)
        if course_match:
            text = course_match.group(1).strip()
            current_course = ParsedCourse(name=_course_name(text), code=_course_code(text), chapters=[])
            courses.append(current_course)
            current_chapter = None
            continue

        chapter_match = EXPLICIT_CHAPTER_RE.match(line)
        if chapter_match:
            if current_course is None:
                raise HTTPException(status_code=422, detail=f"Line {number}: Chapter appears before a Course.")
            current_chapter = ParsedChapter(name=chapter_match.group(1).strip(), topics=[])
            current_course.chapters.append(current_chapter)
            continue

        bullet_match = BULLET_RE.match(line)
        if bullet_match:
            if current_chapter is None:
                raise HTTPException(status_code=422, detail=f"Line {number}: topic appears before a Chapter.")
            name, difficulty = _topic_name_and_difficulty(bullet_match.group(1), number)
            current_chapter.topics.append(ParsedTopic(name=name, difficulty=difficulty))
            continue

        raise HTTPException(
            status_code=422,
            detail=f"Line {number}: expected University, Curriculum, Version, Stream, Course, Chapter, or topic.",
        )

    if not university_name or not university_code:
        raise HTTPException(status_code=422, detail="University name and University Code are required.")
    if not curriculum_name or not curriculum_version:
        raise HTTPException(status_code=422, detail="Curriculum name and Version are required.")
    if not stream_name or not stream_code:
        raise HTTPException(status_code=422, detail="Stream name and Stream Code are required.")

    _validate_parsed(courses)
    return {
        "university_name": university_name,
        "university_code": university_code,
        "curriculum_name": curriculum_name,
        "curriculum_version": curriculum_version,
        "academic_year": academic_year,
        "stream_name": stream_name,
        "stream_code": stream_code,
        "courses": courses,
    }


def parse_bullet_curriculum(content: str) -> list[ParsedCourse]:
    """Parse Havan curriculum files with Course/Chapter labels and [1]-[5] topic difficulty."""
    if re.search(r"^\s*Course:\s*", content, re.IGNORECASE | re.MULTILINE):
        return _parse_explicit_format(content)
    return _parse_legacy_bullets(content)


def _validate_parsed(parsed: list[ParsedCourse]) -> list[ParsedCourse]:
    if not parsed:
        raise HTTPException(status_code=422, detail="The uploaded file contains no curriculum items.")

    for course in parsed:
        if not course.name:
            raise HTTPException(status_code=422, detail="A course name is empty.")
        if not course.chapters:
            raise HTTPException(status_code=422, detail=f"Course '{course.name}' has no chapters.")
        for chapter in course.chapters:
            if not chapter.name:
                raise HTTPException(status_code=422, detail=f"Course '{course.name}' contains an empty chapter.")
            if not chapter.topics:
                raise HTTPException(
                    status_code=422,
                    detail=f"Chapter '{chapter.name}' in course '{course.name}' has no topics.",
                )
    return parsed


def _course_code(name: str) -> str:
    prefix = re.match(r"^\[([A-Za-z0-9_.-]+)\]\s*(.+)$", name)
    suffix = re.match(r"^(.+?)\s+\[([A-Za-z0-9_.-]+)\]$", name)
    if prefix:
        return prefix.group(1)
    if suffix:
        return suffix.group(2)
    words = re.findall(r"[A-Za-z0-9]+", name.upper())
    return "-".join(words[:4])[:40] or "COURSE"


def _course_name(name: str) -> str:
    prefix = re.match(r"^\[([A-Za-z0-9_.-]+)\]\s*(.+)$", name)
    suffix = re.match(r"^(.+?)\s+\[([A-Za-z0-9_.-]+)\]$", name)
    if prefix:
        return prefix.group(2).strip()
    if suffix:
        return suffix.group(1).strip()
    return name.strip()
