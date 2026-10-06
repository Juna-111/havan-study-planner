"""Canonical Plan engine boundary.

The implementation remains temporarily in planner_engine.py for compatibility
with the existing legacy planner. New Plan-zone code imports from this module.
"""
from app.services.planner_engine import (
    DEFAULT_CONFIG,
    ENGINE_VERSION,
    DIFFICULTY_LABELS,
    ExamReadiness,
    PlanRequest,
    PlanResult,
    PlanWarning,
    PlannerConfig,
    PlannerExam,
    PlannerTopic,
    PlannedSession,
    ReasonPart,
    ScoredTopic,
    StudyCalendar,
    UnplacedTopic,
    blend_confidence,
    build_plan,
    default_exam_importance,
    exam_urgency,
    parse_weekdays,
    render_reason,
    score_topic,
    suggest_extras,
    update_pace_factor,
)

__all__ = [
    "DEFAULT_CONFIG", "ENGINE_VERSION", "DIFFICULTY_LABELS",
    "ExamReadiness", "PlanRequest", "PlanResult", "PlanWarning",
    "PlannerConfig", "PlannerExam", "PlannerTopic", "PlannedSession",
    "ReasonPart", "ScoredTopic", "StudyCalendar", "UnplacedTopic",
    "blend_confidence", "build_plan", "default_exam_importance",
    "exam_urgency", "parse_weekdays", "render_reason", "score_topic",
    "suggest_extras", "update_pace_factor",
]
