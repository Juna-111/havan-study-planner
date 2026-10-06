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

