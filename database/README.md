# Database

Havan uses PostgreSQL in production and Alembic for schema migrations.

## Migration policy

Migration history is immutable. Never rewrite or delete an existing migration. New schema changes are added as new migrations.

## Active academic model

The active catalog model is:

Course → Chapter → Topic

University → Curriculum → Stream → University Course Mapping determines which courses a student receives and their Semester 1 or Semester 2 placement.

The old national template, stream-assignment, and university-override workflow is not part of the active MVP.

## Active plan model

The current planner persists data in the unified Plan domain used by `/api/v1/plans`.

## Legacy tables

`study_plans` and `study_tasks` are legacy tables retained for upgrade/data-preservation safety. Their migration history is untouched and the active planner does not write new data to them.

The earlier `havan_plans`, `havan_plan_selections`, and `havan_plan_tasks` tables are also historical planner schema. Their migrations remain intact because migration history is never rewritten.

## Data policy

Current academic records are sample/development data. Real institutional records can be introduced later without redesigning the planner.
