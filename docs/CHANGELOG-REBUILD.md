# Rebuild Changelog

## Phase 0 — Baseline and Safety

Status: RECORDED / LOCAL VERIFICATION PENDING

### Repository
- Repository: `Juna-111/havan-study-planner`
- Branch: `rebuild/phase-0-baseline`
- Baseline commit: `5ceb4c76e5bf4cacc14792834f2b47518d99ee55`

### Verified during repository inspection
- The frontend still contains the large legacy student page and relative imports.
- The backend still imports the existing API modules directly from `main.py`.
- The frontend package remains Next.js 16 / React 19 with the existing Vitest and Oxlint scripts.
- The repository therefore has not yet reached the target architecture.

### Tests
Not executed in the GitHub workspace. Required local checks before Phase 0 is declared green:
- backend: `pytest -q`
- database: `alembic upgrade head` against a scratch database
- frontend: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`

### Code changes
- Added this rebuild decision log.
- Added this rebuild changelog.
- No application behavior has been changed in Phase 0.


## Phase 3 — Foundations: Time, Weekdays, Identity, Types

Status: IMPLEMENTED / LOCAL VERIFICATION PENDING

### Branch
- `rebuild/phase-3-foundations`
- Base: Phase 2 security branch

### Implemented
- Added `backend/app/core/time.py` with the single Addis-local clock and canonical Monday-first weekday names.
- Added idempotent migration `20261006_02_canonical_study_days.py` to convert legacy Sunday=0 study-day values to canonical names.
- Added Sunday regression and study-day mapping tests.
- Updated planner services to use `today_local()` and the canonical weekday parser, with injectable `today` for deterministic service tests.
- Removed the planner engine's duplicate clock implementation; its public weekday parser is now a thin adapter to `core/time.py`.
- Added frontend `lib/weekdays.ts`, `lib/dates.ts`, `lib/format.ts`, `lib/session.ts`, and `lib/types.ts`.
- Hardened `lib/api.ts` with a request timeout, typed `ApiError`, and automatic 401 session clearing.
- Made frontend auth helpers browser-safe and preserved role in shared account types.
- Removed client-key generation from the touched student profile flow; profile creation is account-bound.
- Updated student weekday schema/model types to canonical strings.
- Updated touched student frontend code to use the canonical weekday definition.

### Static audit
- Selected Phase 3 backend/frontend files pass repository text scans for malformed duplicate function declarations, legacy `date.today()` in touched planner paths, `havan_student_key`, and `Record<string, any>` in the new lib files.

### Verification
Not run in the GitHub workspace. Required local checks before Phase 3 is green:
- backend: `pytest -q backend/tests/test_time.py backend/tests/security/test_auth_guards.py`
- backend: `alembic upgrade head` against a scratch database
- frontend: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`
- repository grep: confirm no duplicate weekday definitions in touched paths and zero `Record<string, any>` in `frontend/src/lib/`.



## Phase 4 — The Plan Domain (Backend)

Status: IMPLEMENTED / LOCAL VERIFICATION PENDING

### Branch
- `rebuild/phase-4-plan-domain`
- Base: `rebuild/phase-3-foundations`

### Implemented
- Added canonical Plan persistence: `plans` and `plan_tasks`.
- Added Alembic migration `20261006_03_plan_domain.py`; historical migrations remain untouched.
- Added typed Plan schemas: `PlanInput`, `PlanOut`, readiness, warnings, unplaced topics, and task actions.
- Added `services/plan_adapter.py` to convert student/catalog/progress/exam data into pure `PlanRequest` data.
- Added `services/plan_builder.py` for deterministic preview/save.
- Added `services/plan_actions.py` for START, COMPLETE, SKIP, MOVE, REPEAT, REMOVE, and ADD.
- Added `services/plan/engine.py` as the canonical Plan engine boundary.
- Upgraded the deterministic engine to 2.1.0 with explicit `unplaced` output, five-minute session rounding, known-topic exclusion, optional suggestions, and date-specific pinned capacity.
- Added G1-G5 engine tests, readiness/overload, determinism, known-topic, and suggestion tests.
- Added authenticated `/api/v1/plans/preview`, `POST /api/v1/plans`, `GET /api/v1/plans/current`, and task-action endpoints.
- All Plan endpoints use `current_student`; there is no student-id selector in the canonical Plan API.
- Legacy `study_plans` / `study_tasks` models remain untouched and are explicitly marked as legacy.

### Static audit
- New Plan-domain files contain no `Record[str, any]`, malformed duplicate `def` declarations, dynamic imports, or `date.today()`.
- Canonical Plan code routes through `services/plan/engine.py`.
- Migration 20261006_03 uses explicit indexes without duplicate index flags.

### Verification
Not run in the GitHub workspace. Required before Phase 4 is GREEN:
- `pytest -q backend/tests/plan backend/tests/security`
- `alembic upgrade head` against an empty scratch database
- `alembic upgrade head` from the previous migration head
- backend full `pytest -q`
- frontend checks remain required by the phase gate.


## Phase 5 — Design System and App Shell

Status: IMPLEMENTED / LOCAL VERIFICATION PENDING

### Branch
- `rebuild/phase-5-design-system`
- Base: Phase 4 Plan Domain

### Implemented
- Added semantic Havan design tokens in `frontend/src/styles/tokens.css` using the rebuild specification's light-theme palette, spacing, radii, type scale, shadows, and touch target.
- Added reset/accessibility typography in `styles/base.css` and small layout helpers in `styles/utilities.css`.
- Switched the root layout to `next/font/google` with DM Sans and Fraunces, plus the required responsive viewport export.
- Added the shared UI component set: Button, IconButton, Card, Chip, Segmented, Select, DateField, NumberStepper, Checkbox, TreeSelect, BottomSheet, Toast, Banner, ProgressBar, ProgressRing, Skeleton, EmptyState, and ErrorState.
- Added responsive AppShell primitives: BottomNav, SideNav, PageHeader, and StickyActionBar.
- Added CSS Modules for the shared component and shell layers; no new UI framework or CSS dependency was introduced.
- Added shared component tests for loading-button accessibility and progress clamping.
- Added temporary `/dev/ui` review page gated by `NEXT_PUBLIC_ENABLE_UI_DEV=true`, with representative component states.
- Preserved the existing global stylesheet during the migration so legacy screens are not intentionally stripped before Phase 6.

### Verification
Not run in the GitHub workspace. Required before Phase 5 is GREEN:
- frontend `npm test`
- frontend `npx tsc --noEmit`
- frontend `npm run lint`
- frontend `npm run build`
- manual review at 320, 360, 390, 768, 1024, and 1280 px for overflow and keyboard focus
- contrast check of all semantic token pairs
