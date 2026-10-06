[object Object]

## Final fixes decisions — 2026-10-06

- The canonical planner engine is physically located at `backend/app/services/plan/engine.py`; the former `planner_engine.py` path is removed.
- Existing Alembic migrations remain immutable. New integrity/default changes use `20261006_04` and `20261006_05`.
- Static frontend deployment is intentionally configured as a Next static export with `frontend/out`; Vercel must not force the Next preset.
- A skipped task must not archive the active plan. Future unstarted, unpinned tasks are rebuilt in place while completed, in-progress, skipped, and pinned history remains.
