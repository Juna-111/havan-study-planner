> Historical; not current.\n\n# Phase 5: Deterministic Planning Engine

## Purpose

Generate transparent seven-day study recommendations from the student's real academic context.

## Inputs

- Selected courses
- Senior-student topic difficulty
- Topic estimated study time
- Exam dates and importance
- Topic exam/conceptual importance
- Topic prerequisite relationships
- Topic progress and confidence
- Course confidence provided by the student at registration
- Study hours per day
- Normal study days

## Senior-student difficulty

Havan Academy provides the academic difficulty of each topic using:

- [1] Basic
- [2] Easy
- [3] Intermediate
- [4] Advanced
- [5] Expert

These values are academic signals supplied by experienced senior students. They are stored independently from the student's own confidence and progress.

## Planning rules

1. Completed topics are excluded.
2. Topics with unfinished in-scope prerequisites are excluded until prerequisites are completed.
3. Exam proximity increases priority.
4. Exam importance increases priority.
5. Topic exam and conceptual importance increase priority.
6. Senior-student difficulty contributes to priority.
7. Lower student confidence increases priority.
8. In-progress topics receive a revision signal.
9. Estimated study time affects priority and scheduling.
10. Recommendations are fitted inside the student's available daily capacity.
11. The engine returns transparent reasons behind each recommendation.
12. Long topics can be split across available study sessions without exceeding daily capacity.

## Phase 5 scope

Phase 5 is the deterministic recommendation foundation. It generates StudyPlan, StudyPlanDay response groups, and StudyTask records.

Student task editing, skipping, moving, completion workflows, and dynamic replanning belong to Phase 6, where the Havan MVP becomes an interactive product.

## API

- POST /api/v1/planner/generate
- POST /api/v1/planner/students/{student_id}/generate
- GET /api/v1/planner/students/{student_id}/latest

## Deliberate exclusions

Phase 5 does not use ML or LLMs. Historical exam results are not treated as predictive evidence yet. The first engine is deterministic so its behavior can be inspected, tested, and improved safely.

## Curriculum import

The admin curriculum importer accepts:

```text
Course: [PHY101] Physics

Chapter: Measurement
- Physical quantities [1]
- Units and dimensions [2]

Chapter: Vectors
- Scalars and vectors [2]
- Vector operations [3]
```

The preview shows the supplied difficulty, and the value is stored on the Topic record.

## Migration

- `20261001_03_add_planner.py` creates the planner tables.
- `20261001_04_seed_demo_topics.py` adds simple active topics only to chapters that currently have no topics, so the planner can be demonstrated without overwriting existing academic data.

Render's container startup already runs Alembic upgrade head, so deployment applies pending migrations automatically.
