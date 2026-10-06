# Rebuild Decisions

## 2026-10-06

- The uploaded Havan rebuild specification is the source of truth for this rebuild.
- Rebuild work follows the phase order in Section 10. A phase must be independently reviewable before the next phase begins.
- Existing Alembic migrations are immutable. Schema changes use new migrations only.
- The target product has one planner: the student chooses the study scope and available time; the deterministic engine handles ordering, allocation, spreading, exam readiness, revision, warnings and explanations.
- The Havan brand remains #01017e blue, #fa0302 red, DM Sans, Fraunces.
- Real academic catalog data may be introduced later. Rebuild work must not hard-code assumptions that make the sample catalog impossible to replace.
- No AI/ML planner behavior is introduced during this rebuild.
- Phase 0 execution is being recorded from repository inspection through the GitHub workspace. Full local dependency installation, database migration execution, and browser tests must be run in a real development environment before declaring the phase green.


## Phase 8 decisions

- The unified `/api/v1/plans` API is the only active planner API. Deprecated `/planner` and `/havan-planner` routers are removed after the migration period.
- Legacy planner database tables are preserved for migration/data-export safety. Their models are explicitly marked legacy; existing migrations remain immutable.
- The deterministic implementation lives directly in `services/plan/engine.py`; compatibility re-export layers are removed.
- The frontend no longer keeps the old `/student/*` route tree. The final product navigation is `/auth`, `/onboarding`, `/home`, `/plan`, `/plan/new`, `/progress`, and `/settings`, plus admin routes.
- Academic records remain sample/development data until real institutional data is supplied.
- The Phase 8 structure script is intentionally strict about page/component/CSS/router size, explicit `any`, legacy client-key access, and deep relative imports.
