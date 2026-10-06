"""Legacy planner models.

These tables remain untouched during the Plan-zone migration. New code must
use app.db.models.plan.Plan and PlanTask.
"""
from app.db.models.planner import StudyPlan, StudyTask

__all__ = ["StudyPlan", "StudyTask"]
