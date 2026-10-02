# Phase 6.8: Admin Academic Quality

## Purpose

Phase 6.8 adds an academic-data health layer to Havan Study Planner. It checks the curriculum structure that feeds the deterministic planner and gives administrators understandable issues to review.

The current universities, curriculum versions, streams, courses, chapters, and topics are **sample data**. The quality system validates the structure and values of whatever academic data is loaded. It does not treat today's sample records as the final real curriculum.

## Implemented

- Added `GET /api/v1/academic-quality`.
- Added deterministic checks for:
  - active universities without active curricula
  - active curricula without active streams
  - active streams without active courses
  - active courses without active chapters
  - active chapters without active topics
  - active records whose parent is inactive
  - missing course credit hours
  - empty active-topic names
  - invalid study duration
  - invalid difficulty
  - invalid exam importance
  - invalid conceptual importance
  - duplicate active topic order values inside a chapter
  - missing relationship endpoints
  - self-referencing relationships
  - invalid relationship strength
  - unsupported relationship types
  - duplicate topic relationships
  - prerequisite cycles
- Added a planner-readiness summary showing active courses, ready courses, active topics, invalid topics, and prerequisite-cycle topics.
- Added a Havan-branded Academic Quality workspace to the admin area.
- Added readiness status, issue filtering, summary cards, and refresh controls.
- Added automated backend tests covering representative quality failures and a valid sample course.
- The later MVP cleanup removed the obsolete generic record-management workflow and the legacy full-tree curriculum importer. Academic Quality now routes administrators into the focused setup, mapping, or Freshman registry workspaces.
- No planner-ranking or recommendation logic was changed.

## Planner readiness

A course is considered planner-ready when it is active, has active chapter/topic content, has credit hours, and its active topics pass the planner-critical value checks.

Readiness is:

- `ready`: all active courses represented by the quality check are ready.
- `warning`: some active courses are not ready, but there are no invalid topics or prerequisite cycles.
- `error`: invalid planner-critical topic data or prerequisite cycles exist.

## Sample-data policy

Phase 6.8 does not require every current sample topic or chapter to be academically complete or authoritative. Sample records are test fixtures for the product.

When real curriculum data is added later, the same quality checks should be run after import before that curriculum is relied upon by the planner.

## Known production boundary

The academic-quality API is currently a backend endpoint used by the admin workspace, but full role-based admin authorization is not yet implemented. It should be protected by the application's admin authorization layer before production use.

The repository currently has no persistent backend exam entity, so Phase 6.8 does not invent an exam-quality subsystem.

## Quality model

```
Academic Data
     ↓
Quality Checks
     ↓
Issues / Readiness
     ↓
Admin Review
     ↓
Clean Academic Data
     ↓
Planner Engine
     ↓
Student Plan
```

## Verification

Backend tests are included in `backend/tests/test_academic_quality.py`.

CI should run:

```bash
cd backend
pytest -q

cd ../frontend
npm run lint
npm test
npm run build
```

A manual QA checklist is provided in `docs/PHASE_6_8_TESTING.md`.
