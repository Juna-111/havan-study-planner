from __future__ import annotations

import re
from dataclasses import dataclass

from fastapi import HTTPException


BULLET_RE = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+(.*)$")
EXPLICIT_COURSE_RE = re.compile(r"^\s*Course:\s*(.+?)\s*$", re.IGNORECASE)
EXPLICIT_CHAPTER_RE = re.compile(r"^\s*Chapter:\s*(.+?)\s*$", re.IGNORECASE)
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


def parse_bullet_curriculum(content: str) -> list[ParsedCourse]:
    """Parse the canonical Havan Course -> Chapter -> Topic format."""
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
                raise HTTPException(
                    status_code=422,
                    detail=f"Line {line_number}: Chapter appears before a Course.",
                )
            current_chapter = ParsedChapter(name=chapter_match.group(1).strip(), topics=[])
            current_course.chapters.append(current_chapter)
            continue

        bullet_match = BULLET_RE.match(line)
        if bullet_match:
            if current_chapter is None:
                raise HTTPException(
                    status_code=422,
                    detail=f"Line {line_number}: topic appears before a Chapter.",
                )
            name, difficulty = _topic_name_and_difficulty(bullet_match.group(1), line_number)
            current_chapter.topics.append(ParsedTopic(name=name, difficulty=difficulty))
            continue

        raise HTTPException(
            status_code=422,
            detail=f"Line {line_number}: expected 'Course:', 'Chapter:', or a topic bullet.",
        )

    return _validate_parsed(parsed)


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
                raise HTTPException(
                    status_code=422,
                    detail=f"Course '{course.name}' contains an empty chapter.",
                )
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
