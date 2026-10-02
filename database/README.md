# Database

Havan uses PostgreSQL as the production relational database.

Alembic configuration lives under `backend/database/migrations/`.

## Migration policy

The migration history is part of the database upgrade path. Historical migrations are retained even when an older phase introduced sample or temporary data.

New schema changes must be added as new migrations rather than rewriting or deleting already-applied migrations.

## Current academic model

The current MVP separates:

1. National Freshman course content
2. National Freshman curriculum templates
3. University curriculum mappings
4. Stream course assignments
5. University overrides and exceptions
6. Student course resolution
7. Planner and progress data

Current academic records are sample/development data and are not treated as authoritative institutional data.
