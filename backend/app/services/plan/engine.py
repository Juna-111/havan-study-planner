"""Havan planning engine, version 2.

Pure, deterministic, dependency-free planning logic. Nothing in this module
touches the database, the clock or the network: every input arrives through
``PlanRequest`` and every output leaves through ``PlanResult``. That keeps the
engine easy to test, reproduce and explain.

Principle: the student chooses the topics; Havan organizes the selected work.

Pipeline
--------
1. Validate      the student's selected topics, study days and capacity.
2. Allocate      selected work across the student's available study time.
3. Protect       selected-topic deadlines and explicit student date choices.
4. Report        sessions, exam readiness, warnings and unplaced selected work.

Public API
----------
The active planning entry point is ``allocate_selected_topics``. Supporting input,
output and pacing helpers remain deterministic and dependency-free.
"""
from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass, field, replace
from datetime import date, datetime, timedelta, timezone
from typing import Iterable, Mapping, Sequence

ENGINE_VERSION = "2.1.0"

DIFFICULTY_LABELS = {
    1: "Basic",
    2: "Easy",
    3: "Intermediate",
    4: "Advanced",
    5: "Expert",
}

ADDIS_ABABA_TZ = "Africa/Addis_Ababa"


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))

def session_limit_minutes(
    topic: PlannerTopic,
    config: PlannerConfig | None = None,
) -> int:
    cfg = config or DEFAULT_CONFIG
    if topic.session_minutes is not None:
        return max(
            cfg.min_session_minutes,
            min(cfg.max_session_minutes, topic.session_minutes),
        )
    if topic.progress_status != "NOT_STARTED":
        return cfg.max_session_minutes
    scope_bonus = 5 if topic.estimated_minutes >= 120 else 0
    base = 20 + (max(1, topic.difficulty) - 1) * 5 + scope_bonus
    return max(cfg.min_session_minutes, min(cfg.max_session_minutes, base))


# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class PlannerConfig:
    """Every tunable number in one place. Stored version + config make a plan
    reproducible."""

    # Exams and scheduling.
    study_on_exam_day: bool = False
    tight_ratio: float = 0.85
    min_session_minutes: int = 15
    max_session_minutes: int = 60
    max_course_day_share: float = 0.60

    # Personal pace.
    min_pace_factor: float = 0.5
    max_pace_factor: float = 2.0

    def __post_init__(self) -> None:
        if self.min_session_minutes < 1 or self.max_session_minutes < self.min_session_minutes:
            raise ValueError("Session length limits are inconsistent")


DEFAULT_CONFIG = PlannerConfig()


# --------------------------------------------------------------------------
# Explanations (reason codes -> text). English now; add "am" / "om" catalogs
# after review by native speakers. Missing keys fall back to English.
# --------------------------------------------------------------------------
MESSAGES: dict[str, dict[str, str]] = {
    "en": {
        "exam_in": "{exam_type} is in {days} day(s)",
        "started": "you have already started it, so this session continues your progress",
        "conf_low": "low confidence in this topic",
        "pinned": "you chose this date",
    },
}

ReasonPart = tuple[str, Mapping[str, object]]


def render_reason(parts: Iterable[ReasonPart], lang: str = "en") -> str:
    catalog = MESSAGES.get(lang, {})
    english = MESSAGES["en"]
    return "; ".join(
        (catalog.get(code) or english[code]).format(**params) for code, params in parts
    )


# --------------------------------------------------------------------------
# Input / output types
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class PlannerTopic:
    topic_id: int
    course_id: int
    name: str
    difficulty: int
    estimated_minutes: int            # minutes still needed
    exam_importance: float
    conceptual_importance: float
    session_minutes: int | None = None
    progress_status: str = "NOT_STARTED"
    progress_confidence: int = 3
    chapter_order: int = 0
    topic_order: int = 0
    last_studied_on: date | None = None


@dataclass(frozen=True)
class PlannerExam:
    course_id: int
    exam_date: date
    importance: int
    exam_type: str
    # None means the exam covers the whole course.
    scope_topic_ids: frozenset[int] | None = None

    def covers(self, topic_id: int) -> bool:
        return self.scope_topic_ids is None or topic_id in self.scope_topic_ids



@dataclass(frozen=True)
class StudyCalendar:
    """When and how long the student can study. Weekdays use Python numbering
    (Monday = 0). Use ``parse_weekdays`` to convert stored values."""

    study_weekdays: frozenset[int] = frozenset({0, 1, 2, 3, 4})
    daily_minutes: int = 120
    minutes_by_weekday: Mapping[int, int] = field(default_factory=dict)
    capacity_overrides: Mapping[date, int] = field(default_factory=dict)
    extra_study_dates: frozenset[date] = frozenset()
    blackout_dates: frozenset[date] = frozenset()
    # Minutes already studied (completed or in progress) on a given day.
    done_minutes: Mapping[date, int] = field(default_factory=dict)

    def capacity(self, day: date) -> int:
        if day in self.blackout_dates:
            return 0
        if day.weekday() not in self.study_weekdays and day not in self.extra_study_dates:
            return 0
        base = int(self.capacity_overrides.get(day, self.minutes_by_weekday.get(day.weekday(), self.daily_minutes)))
        return max(0, base - int(self.done_minutes.get(day, 0)))

@dataclass(frozen=True)
class PlanRequest:
    today: date
    topics: Sequence[PlannerTopic]
    exams: Sequence[PlannerExam] = ()
    calendar: StudyCalendar = field(default_factory=StudyCalendar)
    horizon_days: int = 7
    pace_factor: float = 1.0                       # actual / estimated minutes
    deferred_topic_ids: frozenset[int] = frozenset()
    pinned_topic_dates: Mapping[int, date] = field(default_factory=dict)
    known_topic_ids: frozenset[int] = frozenset()  # "I already know this"
    frozen_topic_ids: frozenset[int] = frozenset()  # keep existing sessions; do not reallocate


@dataclass(frozen=True)
class PlannedSession:
    topic_id: int
    course_id: int
    planned_date: date
    minutes: int
    priority: float
    reason: str
    kind: str                                      # "STUDY" or "REVIEW"
    components: Mapping[str, float] = field(default_factory=dict)
    reason_parts: tuple[ReasonPart, ...] = ()


@dataclass(frozen=True)
class ExamReadiness:
    course_id: int
    exam_type: str
    exam_date: date
    days_left: int
    study_days_left: int
    required_minutes: int                # this exam's own remaining work
    cumulative_required_minutes: int     # this exam plus every earlier deadline
    available_minutes: int               # study time until the last study day
    shortfall_minutes: int
    extra_minutes_per_study_day: int
    status: str                          # ON_TRACK, TIGHT or OVERLOADED


@dataclass(frozen=True)
class PlanWarning:
    code: str
    message: str


@dataclass(frozen=True)
class UnplacedTopic:
    topic_id: int
    topic_name: str
    course_id: int
    remaining_minutes: int
    reason_code: str


@dataclass(frozen=True)
class PlanResult:
    engine_version: str
    today: date
    sessions: tuple[PlannedSession, ...]
    readiness: tuple[ExamReadiness, ...]
    warnings: tuple[PlanWarning, ...]
    unplaced: tuple["UnplacedTopic", ...] = ()

    def minutes_by_date(self) -> dict[date, int]:
        totals: dict[date, int] = defaultdict(int)
        for session in self.sessions:
            totals[session.planned_date] += session.minutes
        return dict(totals)


# --------------------------------------------------------------------------
# Small helpers (time, calendar, personalisation)
# --------------------------------------------------------------------------
_DEFAULT_IMPORTANCE = (("FINAL", 5), ("MID", 4), ("TEST", 3), ("QUIZ", 2), ("ASSIGN", 2))


def default_exam_importance(exam_type: str) -> int:
    """Suggested 1..5 importance when the student did not choose one."""
    label = exam_type.strip().upper()
    for prefix, value in _DEFAULT_IMPORTANCE:
        if label.startswith(prefix):
            return value
    return 3


def update_pace_factor(
    previous: float,
    planned_minutes: int,
    actual_minutes: int,
    alpha: float = 0.3,
    config: PlannerConfig = DEFAULT_CONFIG,
) -> float:
    """Moving average of actual / estimated study time. Above 1.0 means the
    student needs more time than the senior-student estimates."""
    if planned_minutes <= 0 or actual_minutes <= 0:
        return _clamp(previous, config.min_pace_factor, config.max_pace_factor)
    ratio = actual_minutes / planned_minutes
    blended = (1 - alpha) * previous + alpha * ratio
    return round(_clamp(blended, config.min_pace_factor, config.max_pace_factor), 4)


def _last_study_day(exam: PlannerExam, today: date, config: PlannerConfig = DEFAULT_CONFIG) -> date:
    """Return the final day on which selected work may count toward an exam.

    By default Havan protects the exam date itself and schedules selected work
    no later than the previous calendar day. The explicit configuration switch
    allows exam-day study without changing which topics were selected.
    """
    if config.study_on_exam_day:
        return exam.exam_date
    return exam.exam_date - timedelta(days=1)


def blend_confidence(previous: int, rating: int, weight: float = 0.6) -> int:
    """New 1..5 confidence after a student rates a finished session."""
    rating = int(_clamp(rating, 1, 5))
    value = previous * (1 - weight) + rating * weight
    return int(_clamp(math.floor(value + 0.5), 1, 5))


# --------------------------------------------------------------------------
# Phase F: intelligent student-choice allocator
# --------------------------------------------------------------------------
def allocate_selected_topics(
    request: PlanRequest,
    config: PlannerConfig = DEFAULT_CONFIG,
) -> PlanResult:
    cfg = config
    today = request.today
    horizon = max(1, request.horizon_days)
    selected = [
        topic for topic in request.topics
        if topic.topic_id not in request.known_topic_ids
        and topic.topic_id not in request.frozen_topic_ids
        and topic.progress_status != "COMPLETED"
    ]
    if not selected:
        return PlanResult(
            engine_version=ENGINE_VERSION,
            today=today,
            sessions=(),
            readiness=(),
            warnings=(
                PlanWarning(
                    "NOTHING_TO_PLAN",
                    "There is no unfinished selected work to schedule.",
                ),
            ),
            unplaced=(),
        )

    pace = _clamp(request.pace_factor, cfg.min_pace_factor, cfg.max_pace_factor)
    remaining = {
        topic.topic_id: max(5, math.ceil(topic.estimated_minutes * pace / 5) * 5)
        for topic in selected
    }

    exams = sorted(
        (exam for exam in request.exams if exam.exam_date >= today),
        key=lambda exam: (
            exam.exam_date,
            exam.course_id,
            exam.importance,
            exam.exam_type,
        ),
    )
    exams_by_topic: dict[int, list[PlannerExam]] = {}
    for topic in selected:
        exams_by_topic[topic.topic_id] = [
            exam
            for exam in exams
            if exam.course_id == topic.course_id and exam.covers(topic.topic_id)
        ]

    def deadline(topic: PlannerTopic) -> date:
        applicable = exams_by_topic.get(topic.topic_id, ())
        if not applicable:
            return today + timedelta(days=horizon - 1)
        return _last_study_day(applicable[0], today, cfg)

    def next_exam(topic: PlannerTopic, day: date) -> PlannerExam | None:
        return next(
            (
                exam
                for exam in exams_by_topic.get(topic.topic_id, ())
                if exam.exam_date >= day
            ),
            None,
        )

    all_days = [
        today + timedelta(days=offset)
        for offset in range(horizon)
    ]
    all_capacities = [
        request.calendar.capacity(day)
        for day in all_days
    ]
    capacity_prefix = [0]
    study_day_prefix = [0]
    for capacity in all_capacities:
        capacity_prefix.append(capacity_prefix[-1] + capacity)
        study_day_prefix.append(
            study_day_prefix[-1] + (1 if capacity > 0 else 0)
        )

    def prefix_at(end: date, values: list[int]) -> int:
        if end < today:
            return 0
        index = min(horizon, (end - today).days + 1)
        return values[index]

    exam_workload = {
        (exam.course_id, exam.exam_type, exam.exam_date): sum(
            remaining[topic.topic_id]
            for topic in selected
            if topic.course_id == exam.course_id and exam.covers(topic.topic_id)
        )
        for exam in exams
    }
    cumulative_exam_workload: list[int] = []
    running = 0
    for exam in exams:
        running += exam_workload[
            (exam.course_id, exam.exam_type, exam.exam_date)
        ]
        cumulative_exam_workload.append(running)

    readiness: list[ExamReadiness] = []
    readiness_warnings: list[PlanWarning] = []
    for exam_index, exam in enumerate(exams):
        last_day = _last_study_day(exam, today, cfg)
        window_end = min(today + timedelta(days=horizon - 1), last_day)
        required = exam_workload[
            (exam.course_id, exam.exam_type, exam.exam_date)
        ]
        available = prefix_at(window_end, capacity_prefix)
        study_days_left = prefix_at(window_end, study_day_prefix)
        cumulative = cumulative_exam_workload[exam_index]
        shortfall = max(0, cumulative - available)
        pressure = cumulative / available if available else (math.inf if cumulative else 0)
        if cumulative == 0 or pressure <= cfg.tight_ratio:
            status = "ON_TRACK"
        elif pressure <= 1.0:
            status = "TIGHT"
        else:
            status = "OVERLOADED"
        readiness.append(
            ExamReadiness(
                course_id=exam.course_id,
                exam_type=exam.exam_type,
                exam_date=exam.exam_date,
                days_left=(exam.exam_date - today).days,
                study_days_left=study_days_left,
                required_minutes=required,
                cumulative_required_minutes=cumulative,
                available_minutes=available,
                shortfall_minutes=shortfall,
                extra_minutes_per_study_day=(
                    math.ceil(shortfall / max(1, study_days_left))
                    if shortfall
                    else 0
                ),
                status=status,
            )
        )
        if status == "OVERLOADED":
            readiness_warnings.append(
                PlanWarning(
                    "EXAM_OVERLOADED",
                    f"{exam.exam_type} needs about {shortfall} more minutes than your study time allows.",
                )
            )

    study_days = [day for day, capacity in zip(all_days, all_capacities) if capacity > 0]
    capacities = {day: capacity for day, capacity in zip(study_days, all_capacities) if capacity > 0}
    if not study_days:
        return PlanResult(
            engine_version=ENGINE_VERSION,
            today=today,
            sessions=(),
            readiness=tuple(readiness),
            warnings=tuple([
                *readiness_warnings,
                PlanWarning(
                    "NO_STUDY_TIME",
                    "There is no free study time inside the planning window.",
                ),
            ]),
            unplaced=tuple(
                UnplacedTopic(
                    topic.topic_id,
                    topic.name,
                    topic.course_id,
                    remaining[topic.topic_id],
                    "no_capacity",
                )
                for topic in selected
            ),
        )
    sessions: list[PlannedSession] = []
    day_course_minutes: dict[date, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    session_index: dict[tuple[int, date, str], int] = {}
    pinned = dict(request.pinned_topic_dates)
    deferred = set(request.deferred_topic_ids)
    pin_warnings: list[PlanWarning] = []

    for topic in selected:
        target = pinned.get(topic.topic_id)
        if target is None or target < today or target > today + timedelta(days=horizon - 1):
            continue
        configured_capacity = capacities.setdefault(
            target,
            request.calendar.capacity(target),
        )
        limit = session_limit_minutes(topic, cfg)
        chunk = min(remaining[topic.topic_id], limit)
        if remaining[topic.topic_id] >= cfg.min_session_minutes:
            chunk = (chunk // 5) * 5
        exam = next_exam(topic, target)
        if exam and target > _last_study_day(exam, today, cfg):
            pin_warnings.append(
                PlanWarning(
                    "PIN_AFTER_EXAM",
                    "You chose a date after this topic's exam deadline. Havan kept your choice.",
                )
            )
        if target.weekday() not in request.calendar.study_weekdays:
            pin_warnings.append(
                PlanWarning(
                    "PIN_NON_STUDY_DAY",
                    "You chose a date that is not normally a study day. Havan kept it for this topic.",
                )
            )
        if chunk > configured_capacity:
            pin_warnings.append(
                PlanWarning(
                    "PIN_OVER_CAPACITY",
                    "This pinned session exceeds the configured capacity for that date, but Havan kept your choice.",
                )
            )
        if chunk >= cfg.min_session_minutes or remaining[topic.topic_id] < cfg.min_session_minutes:
            parts: tuple[ReasonPart, ...] = (("pinned", {}),)
            session_index[(topic.topic_id, target, "STUDY")] = len(sessions)
            day_course_minutes[target][topic.course_id] += chunk
            sessions.append(
                PlannedSession(
                    topic_id=topic.topic_id,
                    course_id=topic.course_id,
                    planned_date=target,
                    minutes=chunk,
                    priority=1.0,
                    reason=render_reason(parts),
                    kind="STUDY",
                    components={"allocation_score": 1.0, "pace_factor": pace},
                    reason_parts=parts,
                )
            )
            remaining[topic.topic_id] -= chunk
            capacities[target] -= chunk

    def sort_key(item: PlannerTopic) -> tuple:
        return (
            deadline(item),
            0 if item.progress_status == "IN_PROGRESS" else 1,
            item.progress_confidence,
            item.chapter_order,
            item.topic_order,
            item.topic_id,
        )

    for day in study_days:
        while capacities.get(day, 0) >= cfg.min_session_minutes:
            eligible = [
                topic
                for topic in selected
                if remaining[topic.topic_id] > 0
                and day <= deadline(topic)
                and not (
                    topic.topic_id in pinned
                    and day < pinned[topic.topic_id]
                )
                and not (
                    topic.topic_id in deferred
                    and day == today
                    and len(study_days) > 1
                )
            ]
            if not eligible:
                break
            eligible.sort(key=sort_key)

            topic = eligible[0]
            day_capacity = request.calendar.capacity(day)
            share_limit = max(
                cfg.min_session_minutes,
                math.floor(day_capacity * cfg.max_course_day_share),
            )
            used_by_course = day_course_minutes[day]
            current_limit = session_limit_minutes(topic, cfg)
            candidate_chunk = min(
                remaining[topic.topic_id],
                capacities[day],
                current_limit,
            )
            alternatives = [
                item
                for item in eligible
                if item.course_id != topic.course_id
                and remaining[item.topic_id] >= cfg.min_session_minutes
            ]
            if alternatives and used_by_course[topic.course_id] + candidate_chunk > share_limit:
                alternatives.sort(key=sort_key)
                topic = alternatives[0]

            limit = session_limit_minutes(topic, cfg)
            chunk = min(remaining[topic.topic_id], capacities[day], limit)
            if remaining[topic.topic_id] < cfg.min_session_minutes:
                chunk = remaining[topic.topic_id]
            else:
                chunk = (chunk // 5) * 5
            if chunk < cfg.min_session_minutes:
                existing_index = next(
                    (
                        index
                        for index, session in enumerate(sessions)
                        if session.topic_id == topic.topic_id
                        and session.planned_date == day
                        and session.kind == "STUDY"
                    ),
                    None,
                )
                if existing_index is None:
                    break
                existing = sessions[existing_index]
                sessions[existing_index] = replace(
                    existing,
                    minutes=existing.minutes + chunk,
                )
                day_course_minutes[day][topic.course_id] += chunk
                remaining[topic.topic_id] = 0
                capacities[day] -= chunk
                continue

            exam = next_exam(topic, day)
            parts: list[ReasonPart] = []
            if exam:
                parts.append(
                    (
                        "exam_in",
                        {
                            "exam_type": exam.exam_type,
                            "days": max(0, (exam.exam_date - day).days),
                        },
                    )
                )
            if topic.progress_status == "IN_PROGRESS":
                parts.append(("started", {}))
            if topic.progress_confidence <= 2:
                parts.append(("conf_low", {}))

            existing_index = session_index.get(
                (topic.topic_id, day, "STUDY")
            )
            if existing_index is not None:
                existing = sessions[existing_index]
                sessions[existing_index] = replace(
                    existing,
                    minutes=existing.minutes + chunk,
                )
            else:
                session_index[(topic.topic_id, day, "STUDY")] = len(sessions)
                sessions.append(
                    PlannedSession(
                        topic_id=topic.topic_id,
                        course_id=topic.course_id,
                        planned_date=day,
                        minutes=chunk,
                        priority=1.0,
                        reason=render_reason(parts),
                        kind="STUDY",
                        components={"allocation_score": 1.0, "pace_factor": pace},
                        reason_parts=tuple(parts),
                    )
                )
            day_course_minutes[day][topic.course_id] += chunk
            remaining[topic.topic_id] -= chunk
            capacities[day] -= chunk

    unplaced: list[UnplacedTopic] = []
    for topic in selected:
        left = remaining[topic.topic_id]
        if left <= 0:
            continue
        last_day = deadline(topic)
        usable = [
            request.calendar.capacity(day)
            for day in study_days
            if day <= last_day
            and not (
                topic.topic_id in pinned
                and day < pinned[topic.topic_id]
            )
        ]
        if last_day < today:
            reason_code = "exam_today_or_passed"
        elif any(capacity >= cfg.min_session_minutes for capacity in usable):
            reason_code = "exam_deadline"
        else:
            reason_code = "no_capacity"
        unplaced.append(
            UnplacedTopic(
                topic.topic_id,
                topic.name,
                topic.course_id,
                left,
                reason_code,
            )
        )

    warnings = list(readiness_warnings)
    warnings.extend(pin_warnings)
    if unplaced:
        warnings.append(
            PlanWarning(
                "DOES_NOT_FIT",
                "Some selected topics could not fit before their available deadlines.",
            )
        )

    return PlanResult(
        engine_version=ENGINE_VERSION,
        today=today,
        sessions=tuple(sessions),
        readiness=tuple(readiness),
        warnings=tuple(dict.fromkeys(warnings)),
        unplaced=tuple(unplaced),
    )

def parse_weekdays(values: Iterable[object] | None, default: frozenset[int] = frozenset({0, 1, 2, 3, 4})) -> frozenset[int]:
    from app.core.time import parse_weekdays as canonical_parse_weekdays
    return canonical_parse_weekdays(values, tuple(default))
