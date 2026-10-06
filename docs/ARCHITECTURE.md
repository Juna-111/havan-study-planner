# Havan architecture

## Zones

**Catalog** contains universities, curricula, streams, courses, chapters, topics, mappings, registry data, and quality checks. Admins write; students read.

**Student** contains accounts, profiles, selected courses, progress, exams, and study habits.

**Plan** turns explicit student choices into a deterministic study plan, tasks, readiness, warnings, and actions.

Dependencies point one way:

`PLAN → STUDENT → CATALOG`

## Backend layers

- `api/`: parse HTTP input, call services, return schemas.
- `services/`: business rules and database queries.
- `services/plan/engine.py`: pure deterministic planning functions. No database, network, or clock.
- `schemas/`: Pydantic request and response models.
- `db/models/`: SQLAlchemy persistence models.
- `core/`: security, configuration, dependencies, and Addis-time helpers.

## Plan API

The canonical API is `/api/v1/plans`.

- `POST /plans/preview` builds without saving.
- `POST /plans` builds and saves the active plan.
- `GET /plans/current` reads the active plan.
- `POST /plans/{plan_id}/tasks/{task_id}/actions` applies a student action.

The browser does not perform allocation or scheduling.

## Legacy database tables

`study_plans` and `study_tasks` are legacy tables. Their Alembic history and model definitions are retained for upgrade/data-preservation safety, but the active application does not use them for planning.

The old `havan_plans`, `havan_plan_selections`, and `havan_plan_tasks` tables are historical schema from the pre-unified planner. Their migrations are retained and are not rewritten or deleted.

## Academic model

Course content is canonical and reusable:

Course → Chapter → Topic

University → Curriculum → Stream → University Course Mapping determines which courses a student receives and whether each is Semester 1 or Semester 2.

No separate university template, stream-assignment, or university-override layer is part of the active MVP workflow.
