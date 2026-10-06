"""Havan planning engine, version 2.

Pure, deterministic, dependency-free planning logic. Nothing in this module
touches the database, the clock or the network: every input arrives through
``PlanRequest`` and every output leaves through ``PlanResult``. That keeps the
engine easy to test, reproduce and explain.

Principle: the system recommends, the student decides.

Pipeline
--------
1. Normalise      completed / "already known" topics, pace factor, study days.
2. Assess         exam workload against available time (earliest-deadline-first).
3. Score          transparent 0..1 priority from named components.
4. Schedule       day by day: exam-aware, interleaved, capacity-safe, honouring the student's skips and pins.
5. Schedule       day by day: dependency-aware, exam-aware, interleaved,
                  capacity-safe, honouring the student's skips and pins.
5. Review         short spaced-revision sessions for completed topics.
6. Report         sessions, exam readiness and warnings.

Backward compatibility
----------------------
``PlannerTopic``, ``PlannerExam``, ``ScoredTopic``, ``exam_urgency``,
``score_topic`` and ``schedule_tasks`` keep their original signatures. New features
are opt-in through optional fields and through ``build_plan``.
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


# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class PlannerConfig:
    """Every tunable number in one place. Stored version + config make a plan
    reproducible."""

    # Score weights (must sum to 1.0).
    w_urgency: float = 0.30
    w_exam_weight: float = 0.12
    w_importance: float = 0.12
    w_difficulty: float = 0.06
    w_time_efficiency: float = 0.03
    w_confidence: float = 0.10
    w_continuation: float = 0.08
    w_sequence: float = 0.19           # freshmen follow lectures: course order matters

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
        total = (
            self.w_urgency + self.w_exam_weight + self.w_importance + self.w_difficulty
            + self.w_time_efficiency + self.w_confidence + self.w_continuation
            + self.w_sequence
        )
        if not math.isclose(total, 1.0, abs_tol=1e-9):
            raise ValueError(f"Score weights must sum to 1.0, got {total:.4f}")
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
        "no_exam": "no upcoming exam is driving this recommendation",
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
    blackout_dates: frozenset[date] = frozenset()
    # Minutes already studied (completed or in progress) on a given day.
    done_minutes: Mapping[date, int] = field(default_factory=dict)

    def capacity(self, day: date) -> int:
        if day in self.blackout_dates or day.weekday() not in self.study_weekdays:
            return 0
        base = int(self.minutes_by_weekday.get(day.weekday(), self.daily_minutes))
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
# Scoring
# --------------------------------------------------------------------------
def exam_urgency(days: int | None, horizon: int = 30) -> float:
    if days is None:
        return 0.0
    if days <= 0:
        return 1.0
    return max(0.0, 1.0 - min(days, horizon) / horizon)


def _percent(ratio: float) -> int:
    return 999 if not math.isfinite(ratio) else min(999, int(round(ratio * 100)))


def score_topic(
    topic: PlannerTopic,
    exam: PlannerExam | None,
    today: date,
    *,
    pressure: float = 0.0,
    sequence: float = 0.0,
    config: PlannerConfig = DEFAULT_CONFIG,
) -> ScoredTopic:
    """Score one topic. ``pressure`` is workload / available time before the
    exam; ``sequence`` is 1 for the earliest remaining topic of the course."""
    cfg = config
    days = None if exam is None else max(0, (exam.exam_date - today).days)
    proximity = exam_urgency(days, cfg.urgency_horizon_days)
    urgency = max(proximity, _clamp(pressure)) if exam else 0.0

    components = {
        "urgency": urgency,
        "exam_weight": (exam.importance / 5) if exam else 0.0,
        "importance": _clamp(topic.exam_importance * 0.65 + topic.conceptual_importance * 0.35),
        "difficulty": _clamp(topic.difficulty / 5),
        "time_efficiency": 1.0 - min(max(topic.estimated_minutes, 1), 180) / 180,
        "confidence_need": _clamp((4 - topic.progress_confidence) / 3),
        "continuation": 1.0 if topic.progress_status == "IN_PROGRESS" else 0.0,
        "sequence": _clamp(sequence),
    }
    score = (
        components["urgency"] * cfg.w_urgency
        + components["exam_weight"] * cfg.w_exam_weight
        + components["importance"] * cfg.w_importance
        + components["difficulty"] * cfg.w_difficulty
        + components["time_efficiency"] * cfg.w_time_efficiency
        + components["confidence_need"] * cfg.w_confidence
        + components["continuation"] * cfg.w_continuation
        + components["sequence"] * cfg.w_sequence
    )

    parts: list[ReasonPart] = []
    if exam is None:
        parts.append(("no_exam", {}))
    else:
        if days == 0:
            parts.append(("exam_today", {"exam_type": exam.exam_type}))
        else:
            parts.append(("exam_in", {"exam_type": exam.exam_type, "days": days}))
        if exam.importance >= 4:
            parts.append(("exam_high", {}))
        else:
            parts.append(("exam_importance", {"value": exam.importance}))
        if pressure >= 0.6:
            parts.append(("workload", {"percent": _percent(pressure)}))
    if topic.exam_importance >= 0.70:
        parts.append(("topic_exam_high", {}))
    elif topic.exam_importance >= 0.50:
        parts.append(("topic_exam_mid", {}))
    parts.append(("difficulty", {"label": DIFFICULTY_LABELS.get(topic.difficulty, "Unrated")}))
    if topic.progress_status == "IN_PROGRESS":
        parts.append(("started", {}))
    elif topic.progress_status == "NOT_STARTED":
        parts.append(("not_started", {}))
    if topic.progress_confidence <= 2:
        parts.append(("conf_low", {}))
    elif topic.progress_confidence >= 4:
        parts.append(("conf_high", {}))
    if sequence >= 0.85:
        parts.append(("early_chapter", {}))

    return ScoredTopic(
        topic=topic,
        score=round(score, 4),
        reason=render_reason(parts),
        exam_days=days,
        components={key: round(value, 4) for key, value in components.items()},
        reason_parts=tuple(parts),
    )


# --------------------------------------------------------------------------
# The planner
# --------------------------------------------------------------------------
@dataclass
class _ExamInfo:
    exam: PlannerExam
    last_day: date
    required: int = 0
    cumulative: int = 0
    supply: int = 0
    study_days_left: int = 0
    pressure: float = 0.0


@dataclass
class _Work:
    topic: PlannerTopic
    kind: str
    remaining: int


@dataclass
class _Evaluation:
    work: _Work
    key: tuple
    base: float
    components: dict[str, float]
    parts: list[ReasonPart]


def _last_study_day(exam: PlannerExam, today: date, cfg: PlannerConfig) -> date:
    if cfg.study_on_exam_day:
        return max(today, exam.exam_date)
    return max(today, exam.exam_date - timedelta(days=1))


def build_plan(request: PlanRequest, config: PlannerConfig = DEFAULT_CONFIG) -> PlanResult:
    cfg = config
    today = request.today
    calendar = request.calendar
    pace = _clamp(request.pace_factor, cfg.min_pace_factor, cfg.max_pace_factor)
    warnings: list[PlanWarning] = []

    # 1. Normalise ---------------------------------------------------------
    topics = sorted(request.topics, key=lambda t: t.topic_id)
    by_id = {t.topic_id: t for t in topics}
    completed = {t.topic_id for t in topics if t.progress_status == "COMPLETED"}
    satisfied = completed | set(request.known_topic_ids)
    remaining_minutes = {
        t.topic_id: max(1, math.ceil(t.estimated_minutes * pace))
        for t in topics
        if t.topic_id not in completed
    }

    horizon = max(1, request.horizon_days)
    study_days = [
        day
        for day in (today + timedelta(days=i) for i in range(horizon))
        if calendar.capacity(day) > 0
    ]
    if not study_days:
        warnings.append(PlanWarning(
            "NO_STUDY_TIME", "There is no free study time inside the planning window."))

    # 2. Assess: exam workload (earliest-deadline-first) -------------------
    upcoming = sorted(
        (e for e in request.exams if e.exam_date >= today),
        key=lambda e: (e.exam_date, e.course_id, e.exam_type),
    )
    infos = [_ExamInfo(e, _last_study_day(e, today, cfg)) for e in upcoming]
    infos_by_course: dict[int, list[_ExamInfo]] = defaultdict(list)
    for info in infos:
        infos_by_course[info.exam.course_id].append(info)

    def exam_for(topic: PlannerTopic, day: date) -> _ExamInfo | None:
        for info in infos_by_course.get(topic.course_id, ()):
            if info.exam.covers(topic.topic_id) and info.last_day >= day:
                return info
        return None

    for tid, minutes in remaining_minutes.items():
        info = exam_for(by_id[tid], today)
        if info:
            info.required += minutes

    if infos:
        end = min(max(i.last_day for i in infos), today + timedelta(days=400))
        cumulative_capacity: dict[date, tuple[int, int]] = {}
        total_minutes = total_days = 0
        day = today
        while day <= end:
            minutes = calendar.capacity(day)
            total_minutes += minutes
            total_days += 1 if minutes > 0 else 0
            cumulative_capacity[day] = (total_minutes, total_days)
            day += timedelta(days=1)
        for info in infos:
            info.supply, info.study_days_left = cumulative_capacity[min(info.last_day, end)]
            info.cumulative = sum(o.required for o in infos if o.last_day <= info.last_day)
            if info.supply > 0:
                info.pressure = info.cumulative / info.supply
            else:
                info.pressure = math.inf if info.cumulative > 0 else 0.0

    readiness: list[ExamReadiness] = []
    for info in infos:
        shortfall = max(0, info.cumulative - info.supply)
        if info.cumulative <= 0:
            status = "ON_TRACK"
        elif info.pressure > 1.0:
            status = "OVERLOADED"
        elif info.pressure > cfg.tight_ratio:
            status = "TIGHT"
        else:
            status = "ON_TRACK"
        readiness.append(ExamReadiness(
            course_id=info.exam.course_id,
            exam_type=info.exam.exam_type,
            exam_date=info.exam.exam_date,
            days_left=(info.exam.exam_date - today).days,
            study_days_left=info.study_days_left,
            required_minutes=info.required,
            cumulative_required_minutes=info.cumulative,
            available_minutes=info.supply,
            shortfall_minutes=shortfall,
            extra_minutes_per_study_day=(
                math.ceil(shortfall / max(1, info.study_days_left)) if shortfall else 0),
            status=status,
        ))
        if status == "OVERLOADED":
            warnings.append(PlanWarning(
                "EXAM_OVERLOADED",
                f"{info.exam.exam_type} (course {info.exam.course_id}) needs about "
                f"{shortfall} more minutes than your study time allows.",
            ))

    # 4. Sequence signal: earlier chapters and topics first ----------------
    sequence: dict[int, float] = {}
    course_topics: dict[int, list[PlannerTopic]] = defaultdict(list)
    for tid in remaining_minutes:
        course_topics[by_id[tid].course_id].append(by_id[tid])
    for items in course_topics.values():
        items.sort(key=lambda t: (t.chapter_order, t.topic_order, t.topic_id))
        n = len(items)
        for index, topic in enumerate(items):
            sequence[topic.topic_id] = 1.0 if n == 1 else 1.0 - index / (n - 1)

    # 5. Work items: study for unfinished topics, review for completed ----
    works: dict[int, _Work] = {}
    for topic in topics:
        if topic.topic_id in satisfied:
            continue
        if topic.topic_id in completed:
            if topic.last_studied_on is not None:
                works[topic.topic_id] = _Work(topic, "REVIEW", cfg.review_minutes)
        else:
            works[topic.topic_id] = _Work(topic, "STUDY", remaining_minutes[topic.topic_id])

    pinned = dict(request.pinned_topic_dates)
    deferred = set(request.deferred_topic_ids)
    first_day = study_days[0] if study_days else None
    multi_day = len(study_days) > 1
    finished_on: dict[int, date] = {}

    def evaluate(
        work: _Work, day: date, used_course: Mapping[int, int], placed_today: set[int],
        review_left: int, day_total: int,
    ) -> _Evaluation | None:
        topic = work.topic
        tid = topic.topic_id
        pin_date = pinned.get(tid)
        if pin_date is not None and day < pin_date:
            return None
        pinned_due = pin_date is not None
        if tid in deferred and multi_day and day == first_day:
            return None

        info = exam_for(topic, day)
        extra: list[ReasonPart] = []

        if work.kind == "REVIEW":
            if review_left <= 0 or topic.last_studied_on is None:
                return None
            age = (day - topic.last_studied_on).days
            confidence = int(_clamp(topic.progress_confidence, 1, 5))
            interval = cfg.review_interval_days.get(confidence, 5)
            days_to_exam = (info.exam.exam_date - day).days if info else None
            near_exam = days_to_exam is not None and days_to_exam <= cfg.review_exam_window_days
            if age < interval or not (near_exam or age >= 2 * interval):
                return None
            components = {
                "overdue": _clamp((age - interval) / max(1, interval)),
                "urgency": exam_urgency(days_to_exam, cfg.urgency_horizon_days),
                "confidence_need": _clamp((4 - confidence) / 3),
                "exam_weight": (info.exam.importance / 5) if info else 0.0,
            }
            base = cfg.review_priority_scale * (
                0.35 * components["overdue"] + 0.30 * components["urgency"]
                + 0.20 * components["confidence_need"] + 0.15 * components["exam_weight"]
            )
            parts: list[ReasonPart] = [("review_due", {"days": age})]
            if info:
                parts.append(("exam_in", {
                    "exam_type": info.exam.exam_type, "days": max(0, days_to_exam or 0)}))
            adjusted = base
        else:
            scored = score_topic(
                replace(topic, estimated_minutes=work.remaining),
                info.exam if info else None,
                day,
                pressure=info.pressure if info else 0.0,
                sequence=sequence.get(tid, 0.0),
                config=cfg,
            )
            base = scored.score
            components = dict(scored.components)
            parts = list(scored.reason_parts)
            adjusted = base

        if pinned_due:
            extra.append(("pinned", {}))
        if tid in deferred:
            adjusted -= cfg.deferred_penalty
            extra.append(("deferred", {}))
        share_cap = max(1.0, day_total * cfg.max_course_day_share)
        adjusted -= cfg.interleave_penalty * min(1.0, used_course.get(topic.course_id, 0) / share_cap)
        if tid in placed_today:
            adjusted -= cfg.same_day_repeat_penalty

        components["adjustment"] = round(adjusted - base, 4)
        key = (
            1 if pinned_due else 0,
            round(adjusted, 6),
            -topic.chapter_order, -topic.topic_order, -tid,
        )
        return _Evaluation(work, key, round(base, 4), components, parts + extra)

    # 6. Schedule, one day at a time ---------------------------------------
    placed: dict[tuple[date, int], dict] = {}
    for day in study_days:
        capacity = calendar.capacity(day)
        day_total = capacity
        review_cap = max(cfg.review_minutes, int(day_total * cfg.review_day_share))
        review_used = 0
        used_course: dict[int, int] = defaultdict(int)
        placed_today: set[int] = set()
        skip: set[int] = set()

        while capacity > 0:
            best: _Evaluation | None = None
            for tid in sorted(works):
                work = works[tid]
                if work.remaining <= 0 or tid in skip:
                    continue
                result = evaluate(work, day, used_course, placed_today,
                                  review_cap - review_used, day_total)
                if result is not None and (best is None or result.key > best.key):
                    best = result
            if best is None:
                break

            work = best.work
            tid = work.topic.topic_id
            if work.kind == "REVIEW":
                chunk = min(work.remaining, capacity, review_cap - review_used)
            else:
                chunk = min(work.remaining, capacity, cfg.max_session_minutes)
            chunk = (chunk // 5) * 5
            if chunk <= 0 or (chunk < work.remaining and chunk < cfg.min_session_minutes):
                skip.add(tid)
                continue

            record = placed.setdefault((day, tid), {
                "minutes": 0, "priority": best.base, "kind": work.kind,
                "course": work.topic.course_id, "components": best.components,
                "parts": tuple(best.parts),
            })
            record["minutes"] += chunk
            work.remaining -= chunk
            capacity -= chunk
            used_course[work.topic.course_id] += chunk
            placed_today.add(tid)
            if work.kind == "REVIEW":
                review_used += chunk
            elif work.remaining <= 0:
                finished_on[tid] = day

    sessions = tuple(
        PlannedSession(
            topic_id=tid,
            course_id=rec["course"],
            planned_date=day,
            minutes=rec["minutes"],
            priority=rec["priority"],
            reason=render_reason(rec["parts"]),
            kind=rec["kind"],
            components=rec["components"],
            reason_parts=rec["parts"],
        )
        for (day, tid), rec in placed.items()
    )

    # 7. Report ------------------------------------------------------------
    session_minutes = defaultdict(int)
    for session in sessions:
        session_minutes[session.topic_id] += session.minutes

    unplaced: list[UnplacedTopic] = []
    for topic in topics:
        if topic.topic_id in satisfied:
            continue
        required = remaining_minutes.get(topic.topic_id, 0)
        placed_minutes = session_minutes.get(topic.topic_id, 0)
        remaining = max(0, required - placed_minutes)
        if remaining <= 0:
            continue
        reason_code = "no_capacity"
        if any(
            exam.course_id == topic.course_id
            and exam.exam_date < today
            and exam.covers(topic.topic_id)
            for exam in request.exams
        ):
            reason_code = "exam_passed"
        unplaced.append(UnplacedTopic(
            topic_id=topic.topic_id,
            topic_name=topic.name,
            course_id=topic.course_id,
            remaining_minutes=remaining,
            reason_code=reason_code,
        ))

    if unplaced:
        warnings.append(PlanWarning(
            "DOES_NOT_FIT",
            "Some selected topics do not fit in the available study time.",
        ))

    return PlanResult(
        engine_version=ENGINE_VERSION,
        today=today,
        sessions=sessions,
        readiness=tuple(readiness),
        warnings=tuple(warnings),
        unplaced=tuple(sorted(unplaced, key=lambda item: item.topic_id)),
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
    return output\n\ndef parse_weekdays(values: Iterable[object] | None, default: frozenset[int] = frozenset({0, 1, 2, 3, 4})) -> frozenset[int]:
    from app.core.time import parse_weekdays as canonical_parse_weekdays
    return canonical_parse_weekdays(values, tuple(default))
t

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
