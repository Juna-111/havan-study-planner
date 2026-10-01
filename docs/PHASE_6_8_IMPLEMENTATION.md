# Phase 6.8: Admin Academic Quality

## Purpose

Phase 6.8 adds an academic-data health layer to Havan Study Planner. It checks the curriculum structure that feeds the deterministic planner and gives administrators understandable issues to review.

## Implemented

- Added `GET /api/v1/academic-quality`.
- Added deterministic checks for:
  - active universities without active curricula
  - active curricula without active streams
  - active streams without active courses
  - active courses without active chapters
  - active chapters without active topics
  - missing course credit hours
  - invalid active-topic values
  - duplicate active topic order values inside a chapter
  - duplicate topic relationships
  - prerequisite cycles that can prevent clean planner ordering
- Added counts, severity totals, and actionable issue messages.
- Added a Havan-branded Academic Quality workspace to the admin area.
- Added responsive summary cards, issue filtering, and refresh controls.
- Existing curriculum import and record-management workflows remain unchanged.
- No planner-ranking or recommendation logic was changed.

## Quality model

```
Academic Data
     ↓
Quality Checks
     ↓
Issues / Warnings
     ↓
Admin Review
     ↓
Clean Academic Data
     ↓
Planner Engine
     ↓
Student Plan
```

## Notes

The current repository has no persistent exam entity in the academic database model, so Phase 6.8 does not invent an exam-quality subsystem. Exam validation can be added when exams become a backend academic entity.

## Verification

Backend tests cover route registration, missing-content detection, and prerequisite-cycle detection. Frontend lint, tests, and production build should be run by CI after the implementation commit.
