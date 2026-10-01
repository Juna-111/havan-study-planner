# Phase 6.6: Recommendation Explanations

## Goal

Phase 6.6 makes Havan's deterministic planner reasoning visible to students without changing the recommendation engine or introducing AI/ML.

The product principle is:

> Havan recommends. You decide. Havan explains and adapts.

## Implementation

The existing planner engine remains the source of recommendation decisions.

Each scheduled StudyTask already receives the engine-generated reason string. The planner UI now treats that value as the source of truth instead of independently recreating the recommendation logic.

The explanation UI can additionally show current progress and session-capacity context when those values add useful context.

## Signals explained

Depending on the recommendation, Havan can explain:

- exam urgency
- assessment importance
- topic exam importance
- conceptual importance
- senior-student difficulty
- student confidence
- current topic progress
- prerequisite readiness
- estimated study time
- available study capacity
- revision need

Only signals actually available to the planner are presented.

## Student decision explanations

Phase 6.6 also explains the effect of student-controlled changes.

### START

Starting a focus session does not change the schedule. The plan remains unchanged until the student completes, skips, or moves the session.

### COMPLETE

Completion is recorded as academic progress. Havan then recalculates the remaining recommendations around the newly completed work.

### SKIP

The skipped topic is recorded as a deliberate student decision. The planner defers it so it does not immediately return on the first study day, then rebuilds the remaining schedule around the available capacity.

### MOVE

The moved session is pinned to the selected future date. Havan recalculates the remaining schedule around that new commitment.

## UI

The feature uses the existing Havan Study Planner visual system:

- Havan blue and red
- existing typography
- existing cards and panels
- existing spacing and border treatment
- existing responsive behavior
- no separate AI-themed interface

A small HAVAN ADAPTATION notice appears after a student changes a task so the consequence of that decision is visible without interrupting the planner workflow.

## Architecture

The flow remains:

Student academic state
→ deterministic planner engine
→ recommendation + engine reason
→ Phase 6.6 explanation layer
→ Havan planner UI

The explanation layer does not make a second recommendation.

## Files

- frontend/src/app/student/planner/page.tsx
  - Uses planner-engine reasons as the explanation source.
  - Adds contextual explanation details.
  - Shows explicit decision-impact explanations for START, COMPLETE, SKIP, and MOVE.
  - Removes stale Phase 6.1 wording.

- frontend/src/app/student/planner/planner.css
  - Adds the Havan-styled adaptation notice.

- docs/PHASE_6_6_IMPLEMENTATION.md
  - Documents the Phase 6.6 behavior and architecture.

## Verification

The implementation should be verified with:

    cd frontend
    npm run build
    npm run test

Manual verification should cover:

1. Open a recommendation and inspect "WHY HAVAN RECOMMENDS IT".
2. Confirm the displayed reasons match the task's stored planner reason.
3. Start a task and confirm the schedule does not change.
4. Complete a task and confirm the adaptation notice explains the recalculation.
5. Skip a task and confirm the adaptation notice explains deferral and rebalancing.
6. Move a task and confirm the adaptation notice identifies the new date and schedule impact.
7. Confirm the Havan branding remains unchanged on desktop and mobile.

## Status

Phase 6.6 implementation is complete pending build/test verification in the project environment.
