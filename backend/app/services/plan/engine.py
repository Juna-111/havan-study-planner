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

Backward compatibility
----------------------
The active public entry point is ``allocate_selected_topics``. Supporting input,
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

def session_limit_minutes(topic: PlannerTopic) -> int:
    if topic.session_minutes is not None:
        return max(5, min(120, topic.session_minutes))
    if topic.progress_status != "NOT_STARTED":
        return 60
    scope_bonus = 3 if topic.estimated_minutes >= 120 else 0
    return max(20, min(35, 20 + (max(1, topic.difficulty) - 1) * 3 + scope_bonus))



# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class PlannerConfig:
    """Every tunable number in one place. Stored version + config make a plan
    reproducible."""

    # Exams.
    urgency_horizon_days: int = 30
    study_on_exam_day: bool = False
    tight_ratio: float = 0.85          # workload / time above this is "TIGHT"

    # Scheduling shape.
    min_session_minutes: int = 15      # never leave a fragment shorter than this
    max_session_minutes: int = 60      # one sitting per topic before switching
    interleave_penalty: float = 0.12   # spread a day across courses
    max_course_day_share: float = 0.60
    same_day_repeat_penalty: float = 0.25
    deferred_penalty: float = 0.10

    # Spaced revision.
    review_minutes: int = 20
    review_priority_scale: float = 0.70
    review_exam_window_days: int = 21
    review_day_share: float = 0.30
    review_interval_days: Mapping[int, int] = field(
        default_factory=lambda: {1: 2, 2: 3, 3: 5, 4: 8, 5: 12}
    )

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
        "exam_today": "{exam_type} is today",
        "student_selected": "you selected this topic",
        "adaptive_allocation": "Havan allocated time using your available capacity and current study progress",
        "no_exam": "no upcoming exam is driving this allocation",
        "exam_high": "the assessment has high importance",
        "exam_importance": "the assessment importance is {value}/5",
        "topic_exam_high": "the topic has high exam importance",
        "topic_exam_mid": "the topic has moderate exam importance",
        "difficulty": "{label} difficulty (rated by senior students)",
        "started": "you have already started it, so this session continues your progress",
        "not_started": "it is not started yet",
        "conf_low": "low confidence in this topic",
        "conf_high": "your confidence is already strong",
        "workload": "the work left before this exam is about {percent}% of your available study time",
        "early_chapter": "it comes early in the course sequence",
        "pinned": "you chose this date",
        "deferred": "you postponed it, so it is placed later",
        "review_due": "revision is due: {days} day(s) since you last studied it",
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
class ScoredTopic:
    topic: PlannerTopic
    score: float
    reason: str
    exam_days: int | None
    components: Mapping[str, float] = field(default_factory=dict)
    reason_parts: tuple[ReasonPart, ...] = ()


@dataclass(frozen=True)
class StudyCalendar:
    """When and how long the student can study. Weekdays use Python numbering
    (Monday = 0). Use ``parse_weekdays`` to convert stored values."""

    study_weekdays: frozenset[int] = frozenset({0, 1, 2, 3, 4})
    daily_minutes: int = 120
    minutes_by_weekday: Mapping[int, int] = field(default_factory=dict)
    capacity_overrides: Mapping[date, int] = field(default_factory=dict)
    blackout_dates: frozenset[date] = frozenset()
    # Minutes already studied (completed or in progress) on a given day.
    done_minutes: Mapping[date, int] = field(default_factory=dict)

    def capacity(self, day: date) -> int:
        if day in self.blackout_dates or day.weekday() not in self.study_weekdays:
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
    """Intelligently organise only the topics the student selected.

    Intelligence here means allocation quality, not topic discovery:
    - never adds an unselected topic;
    - adapts workload to observed pace;
    - protects exam deadlines for selected topics;
    - spreads work across selected courses and days;
    - keeps chapter/topic order as a soft learning-sequence signal;
    - avoids tiny fragments and over-capacity days;
    - explains every allocation with transparent reason parts.
    """
    cfg = config
    today = request.today
    horizon = max(1, request.horizon_days)
    selected = [
        topic for topic in request.topics
        if topic.topic_id not in request.known_topic_ids
        and topic.progress_status != "COMPLETED"
    ]
    if not selected:
        raise ValueError("Select at least one unfinished topic.")

    study_days = [
        today + timedelta(days=offset)
        for offset in range(horizon)
        if request.calendar.capacity(today + timedelta(days=offset)) > 0
    ]
    engine_version = "3.1.0-choice"
    if not study_days:
        return PlanResult(
            engine_version=engine_version,
            today=today,
            sessions=(),
            readiness=(),
            warnings=(PlanWarning("NO_STUDY_TIME", "There is no free study time inside the planning window."),),
            unplaced=tuple(
                UnplacedTopic(topic.topic_id, topic.name, topic.course_id, max(5, topic.estimated_minutes), "no_capacity")
                for topic in selected
            ),
        )

    pace = _clamp(request.pace_factor, cfg.min_pace_factor, cfg.max_pace_factor)
    remaining = {
        topic.topic_id: max(
            cfg.min_session_minutes,
            math.ceil(topic.estimated_minutes * pace / 5) * 5,
        )
        for topic in selected
    }

    exams_by_course: dict[int, list[PlannerExam]] = defaultdict(list)
    for exam in request.exams:
        if exam.exam_date >= today:
            exams_by_course[exam.course_id].append(exam)
    for exams in exams_by_course.values():
        exams.sort(key=lambda exam: (exam.exam_date, exam.importance, exam.exam_type))

    def next_exam(topic: PlannerTopic, day: date) -> PlannerExam | None:
        return next(
            (
                exam for exam in exams_by_course.get(topic.course_id, ())
                if exam.exam_date >= day and exam.covers(topic.topic_id)
            ),
            None,
        )

    # Readiness is calculated from the same selected-workload definition used
    # by the allocator. It is a constraint report, never a source of topics.
    readiness: list[ExamReadiness] = []
    readiness_warnings: list[PlanWarning] = []
    for exam in sorted(
        (exam for exams in exams_by_course.values() for exam in exams),
        key=lambda item: (item.exam_date, item.course_id, item.exam_type),
    ):
        last_day = _last_study_day(exam, today, cfg)
        required = sum(
            remaining[topic.topic_id]
            for topic in selected
            if topic.course_id == exam.course_id and exam.covers(topic.topic_id)
        )
        end = max(today, last_day)
        available = sum(
            request.calendar.capacity(today + timedelta(days=offset))
            for offset in range((end - today).days + 1)
        )
        study_days_left = sum(
            1
            for offset in range((end - today).days + 1)
            if request.calendar.capacity(today + timedelta(days=offset)) > 0
        )
        cumulative = sum(
            earlier_required
            for earlier_exam in sorted(
                (item for exams in exams_by_course.values() for item in exams),
                key=lambda item: (item.exam_date, item.course_id, item.exam_type),
            )
            if earlier_exam.exam_date <= exam.exam_date
            for earlier_required in [
                sum(
                    remaining[topic.topic_id]
                    for topic in selected
                    if topic.course_id == earlier_exam.course_id
                    and earlier_exam.covers(topic.topic_id)
                )
            ]
        )
        shortfall = max(0, cumulative - available)
        pressure = cumulative / available if available > 0 else (math.inf if cumulative else 0.0)
        if cumulative <= 0:
            status = "ON_TRACK"
        elif pressure > 1.0:
            status = "OVERLOADED"
        elif pressure > cfg.tight_ratio:
            status = "TIGHT"
        else:
            status = "ON_TRACK"
        readiness.append(ExamReadiness(
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
                math.ceil(shortfall / max(1, study_days_left)) if shortfall else 0
            ),
            status=status,
        ))
        if status == "OVERLOADED":
            readiness_warnings.append(PlanWarning(
                "EXAM_OVERLOADED",
                f"{exam.exam_type} (course {exam.course_id}) needs about "
                f"{shortfall} more minutes than your study time allows.",
            ))

    capacities = {
        day: request.calendar.capacity(day)
        for day in study_days
    }
    used_course: dict[date, dict[int, int]] = defaultdict(lambda: defaultdict(int))
    placed_today: dict[date, set[int]] = defaultdict(set)
    sessions: list[PlannedSession] = []
    pinned = dict(request.pinned_topic_dates)
    deferred = set(request.deferred_topic_ids)

    def rank(topic: PlannerTopic, day: date) -> tuple[float, float, float, float, float]:
        exam = next_exam(topic, day)
        days_left = (exam.exam_date - day).days if exam else None
        deadline_pressure = (
            1.0 if days_left is not None and days_left <= 0
            else (1.0 / (days_left + 1) if days_left is not None else 0.0)
        )
        total_remaining = max(1, sum(remaining.values()))
        workload_pressure = min(1.0, remaining[topic.topic_id] / total_remaining)
        continuation = 0.08 if topic.progress_status == "IN_PROGRESS" else 0.0
        confidence_need = max(0.0, (4 - topic.progress_confidence) / 15)
        sequence = 1.0 / (1 + topic.chapter_order * 0.25 + topic.topic_order * 0.05)
        course_load = used_course[day].get(topic.course_id, 0)
        total_day = sum(used_course[day].values())
        share_penalty = course_load / max(1, total_day)
        coverage_bonus = 0.18 if total_day > 0 and topic.course_id not in used_course[day] else 0.0
        repeat_penalty = 0.12 if topic.topic_id in placed_today[day] else 0.0
        deferred_penalty = 0.10 if topic.topic_id in deferred and day == study_days[0] else 0.0
        score = (
            deadline_pressure * 0.42
            + workload_pressure * 0.16
            + continuation
            + confidence_need
            + sequence * 0.16
            + coverage_bonus
            - share_penalty * 0.35
            - repeat_penalty
            - deferred_penalty
        )
        return (
            score,
            -float(remaining[topic.topic_id]),
            -float(topic.chapter_order),
            -float(topic.topic_order),
            -float(topic.topic_id),
        )

    def add_session(
        topic: PlannerTopic,
        day: date,
        minutes: int,
        *,
        pinned_session: bool = False,
    ) -> None:
        parts: tuple[ReasonPart, ...] = (
            ("student_selected", {}),
            ("adaptive_allocation", {}),
        )
        exam = next_exam(topic, day)
        if exam:
            parts += ((
                "exam_in",
                {"exam_type": exam.exam_type, "days": max(0, (exam.exam_date - day).days)},
            ),)
        if topic.progress_status == "IN_PROGRESS":
            parts += (("started", {}),)
        if topic.progress_confidence <= 2:
            parts += (("conf_low", {}),)
        if pinned_session:
            parts += (("pinned", {}),)
        score = rank(topic, day)[0]
        sessions.append(PlannedSession(
            topic_id=topic.topic_id,
            course_id=topic.course_id,
            planned_date=day,
            minutes=minutes,
            priority=score,
            reason=render_reason(parts),
            kind="STUDY",
            components={
                "allocation_score": score,
                "pace_factor": pace,
                "remaining_minutes": float(remaining[topic.topic_id]),
            },
            reason_parts=parts,
        ))
        remaining[topic.topic_id] -= minutes
        capacities[day] -= minutes
        used_course[day][topic.course_id] += minutes
        placed_today[day].add(topic.topic_id)

    # Explicit student dates are honoured before automatic balancing.
    for topic in selected:
        target = pinned.get(topic.topic_id)
        if target is None or remaining[topic.topic_id] <= 0:
            continue
        if target not in capacities:
            capacities[target] = request.calendar.capacity(target)
            used_course[target] = defaultdict(int)
            placed_today[target] = set()
        chunk = min(remaining[topic.topic_id], capacities[target], session_limit_minutes(topic))
        chunk = (chunk // 5) * 5
        if chunk >= cfg.min_session_minutes:
            add_session(topic, target, chunk, pinned_session=True)

    # Allocate one meaningful block at a time. Prefer a new topic/course on a
    # day, but permit a repeat when it is the only viable work left.
    while any(value > 0 for value in remaining.values()):
        candidate_days = [
            day for day in study_days
            if capacities.get(day, 0) >= cfg.min_session_minutes
        ]
        if not candidate_days:
            break

        best_pair = None
        for day in candidate_days:
            eligible = [
                topic for topic in selected
                if remaining[topic.topic_id] >= cfg.min_session_minutes
                and not (
                    topic.topic_id in pinned
                    and day < pinned[topic.topic_id]
                )
                and not (
                    topic.topic_id in deferred
                    and day == study_days[0]
                    and len(study_days) > 1
                )
            ]
            if not eligible:
                continue
            fresh = [topic for topic in eligible if topic.topic_id not in placed_today[day]]
            pool = fresh or eligible
            for topic in pool:
                score = rank(topic, day)
                # Earlier days win; within a day, rank drives the choice.
                day_key = (score, -day.toordinal(), capacities[day])
                if best_pair is None or day_key > best_pair[0]:
                    best_pair = (day_key, topic, day)

        if best_pair is None:
            break
        _, topic, day = best_pair
        chunk = min(remaining[topic.topic_id], capacities[day], session_limit_minutes(topic))
        chunk = (chunk // 5) * 5
        if chunk < cfg.min_session_minutes:
            capacities[day] = 0
            continue
        add_session(topic, day, chunk)

    unplaced = tuple(
        UnplacedTopic(topic.topic_id, topic.name, topic.course_id, minutes, "no_capacity")
        for topic in selected
        if (minutes := remaining[topic.topic_id]) > 0
    )
    warnings = list(readiness_warnings)
    if unplaced:
        warnings.append(PlanWarning(
            "DOES_NOT_FIT",
            "Some selected topics need more time than the available study capacity.",
        ))

    return PlanResult(
        engine_version=engine_version,
        today=today,
        sessions=tuple(sessions),
        readiness=tuple(readiness),
        warnings=tuple(dict.fromkeys(warnings)),
        unplaced=unplaced,
    )

# --------------------------------------------------------------------------
# Legacy scheduler (kept so the current service keeps working)
# --------------------------------------------------------------------------
def schedule_tasks(
    scored: list[ScoredTopic],
    study_dates: list[date],
    daily_capacity: int,
    deferred_topic_ids: set[int] | None = None,
    pinned_topic_dates: dict[int, date] | None = None,
) -> list[tuple[ScoredTopic, date, int]]:
    """Pack pre-scored recommendations into days. Prefer ``build_plan``, which
    adds deadlines, dependencies, interleaving, revision and readiness."""
    if not study_dates or daily_capacity <= 0:
        return []

    deferred_topic_ids = deferred_topic_ids or set()
    pinned_topic_dates = pinned_topic_dates or {}
    output: list[tuple[ScoredTopic, date, int]] = []
    day_used = {day: 0 for day in study_dates}
    by_id = {item.topic.topic_id: item for item in scored}
    pinned_ids: set[int] = set()

    for topic_id, requested_date in sorted(pinned_topic_dates.items(), key=lambda i: (i[1], i[0])):
        item = by_id.get(topic_id)
        if item is None:
            continue
        remaining = max(1, item.topic.estimated_minutes)
        for day in (d for d in study_dates if d >= requested_date):
            available = daily_capacity - day_used[day]
            if available <= 0:
                continue
            duration = min(remaining, available)
            output.append((item, day, duration))
            day_used[day] += duration
            remaining -= duration
            if remaining <= 0:
                pinned_ids.add(topic_id)
                break

    ordered = sorted(
        (item for item in scored if item.topic.topic_id not in pinned_ids),
        key=lambda item: (
            item.topic.topic_id in deferred_topic_ids,
            -item.score,
            item.topic.estimated_minutes,
            item.topic.chapter_order,
            item.topic.topic_order,
            item.topic.topic_id,
        ),
    )
    for item in ordered:
        remaining = max(1, item.topic.estimated_minutes)
        for day in study_dates:
            if item.topic.topic_id in deferred_topic_ids and day == study_dates[0]:
                continue
            available = daily_capacity - day_used[day]
            if available <= 0:
                continue
            duration = min(remaining, available)
            output.append((item, day, duration))
            day_used[day] += duration
            remaining -= duration
            if remaining <= 0:
                break
    return output


def parse_weekdays(values: Iterable[object] | None, default: frozenset[int] = frozenset({0, 1, 2, 3, 4})) -> frozenset[int]:
    from app.core.time import parse_weekdays as canonical_parse_weekdays
    return canonical_parse_weekdays(values, tuple(default))

def suggest_extras(request: PlanRequest, extra_topics: Sequence[PlannerTopic], k: int = 5, config: PlannerConfig = DEFAULT_CONFIG) -> tuple[ScoredTopic, ...]:
    """Score optional topics without ever adding them to the plan."""
    selected = {topic.topic_id for topic in request.topics}
    candidates = [topic for topic in extra_topics if topic.topic_id not in selected]
    scored = []
    for topic in candidates:
        exam = next((item for item in sorted(request.exams, key=lambda value: value.exam_date)
                     if item.course_id == topic.course_id and item.exam_date >= request.today and item.covers(topic.topic_id)), None)
        scored.append(score_topic(topic, exam, request.today, config=config))
    return tuple(sorted(scored, key=lambda item: (-item.score, item.topic.course_id, item.topic.topic_id))[:max(0, k)])
