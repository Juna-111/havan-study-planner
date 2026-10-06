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
