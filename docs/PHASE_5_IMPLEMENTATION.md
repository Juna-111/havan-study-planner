# Phase 5: Deterministic Planning Engine

## Purpose

Generate transparent seven-day study recommendations from the student's real academic context.

## Inputs

- Selected courses
- Topic difficulty and estimated study time
- Exam dates and importance
- Topic exam/conceptual importance
- Topic prerequisite relationships
- Topic progress and confidence
- Study hours per day
- Normal study days

## Planning rules

1. Completed topics are excluded.
2. Topics with unfinished prerequisites are excluded until prerequisites are completed.
3. Exam proximity increases priority.
4. Exam importance increases priority.
5. Topic importance increases priority.
6. Higher difficulty contributes to priority.
7. Lower student confidence increases priority.
8. Recommendations are fitted inside the student's daily capacity.
9. The engine returns the reasons behind each recommendation.

## Student controls

Each generated task can be:

- Completed
- Skipped
- Moved one day forward
- Regenerated as a new plan

Completing a task synchronizes the student's topic progress to COMPLETED.

## API

- POST /api/v1/planner/students/{student_id}/generate
- GET /api/v1/planner/students/{student_id}/latest
- PATCH /api/v1/planner/students/{student_id}/tasks/{task_id}

## Deliberate exclusions

Phase 5 does not use ML, LLMs, historical exam prediction, or opaque recommendation scores. Those are future layers. The first engine is deterministic so its behavior can be inspected, tested, and improved safely.

## Migration

20261001_03_add_planner.py creates study_plans and study_tasks.

Render's container startup already runs Alembic upgrade head, so deployment will apply this migration automatically.
