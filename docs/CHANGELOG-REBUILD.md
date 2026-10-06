# Rebuild Changelog

## Phase 0 — Baseline and Safety

Status: IN PROGRESS

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
