from __future__ import annotations

import re
from dataclasses import dataclass

from fastapi import HTTPException


BULLET_RE = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+(.*)$")


@dataclass
class ParsedTopic:
    name: str


@dataclass
class ParsedChapter:
    name: str
    topics: list[ParsedTopic]


@dataclass
class ParsedCourse:
    name: str
    code: str
    chapters: list[ParsedChapter]


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


def parse_bullet_curriculum(content: str) -> list[ParsedCourse]:
    """Parse a three-level bullet file: course -> chapter -> topic."""
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

        current_chapter.topics.append(ParsedTopic(name=text))

    if not parsed:
        raise HTTPException(status_code=422, detail="The uploaded file contains no bullet items.")

    for course in parsed:
        if not course.chapters:
            raise HTTPException(status_code=422, detail=f"Course '{course.name}' has no chapters.")
        for chapter in course.chapters:
            if not chapter.topics:
                raise HTTPException(
                    status_code=422,
                    detail=f"Chapter '{chapter.name}' in course '{course.name}' has no topics.",
                )
    return parsed


def _course_code(name: str) -> str:
    match = re.match(r"^\[([A-Za-z0-9_.-]+)\]\s*(.+)$", name)
    if match:
        return match.group(1)
    words = re.findall(r"[A-Za-z0-9]+", name.upper())
    return "-".join(words[:4])[:40] or "COURSE"


def _course_name(name: str) -> str:
    match = re.match(r"^\[([A-Za-z0-9_.-]+)\]\s*(.+)$", name)
    return match.group(2).strip() if match else name
