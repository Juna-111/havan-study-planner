# Repository map

## Frontend

- `frontend/src/app/` — Next.js route wiring. Pages should stay small.
- `frontend/src/features/` — product-area screens and feature components.
- `frontend/src/components/` — reusable Havan UI and layout primitives.
- `frontend/src/lib/` — API client, auth/session, dates, types, and small pure helpers.
- `frontend/src/styles/` — Havan design tokens and global styling.

## Backend

- `backend/app/api/` — HTTP route wiring only.
- `backend/app/services/` — business rules and database operations.
- `backend/app/services/plan/` — the canonical deterministic planning engine and Plan-domain code.
- `backend/app/schemas/` — typed API request/response models.
- `backend/app/db/models/` — SQLAlchemy models.
- `backend/app/core/` — configuration, security, dependencies, time, and errors.
- `backend/database/migrations/` — immutable Alembic history plus new migrations.

## Tests and documentation

- `backend/tests/` — backend unit and API tests.
- `frontend/src/**/*.test.*` — frontend unit tests.
- `scripts/check-structure.mjs` — structural hygiene gate.
- `docs/` — current product, architecture, development, decisions, and phase records.
