# Phase 6.3: Dynamic Replanning

## Goal

Phase 6.3 turns the planner into an adaptive system. A student decision is no longer only recorded; it changes the remaining recommendation.

The product loop becomes:

Plan → Study → Record → Recalculate → Continue

## What changes the plan

- Complete: the completed topic is removed from future recommendations through student topic progress.
- Skip: the skipped topic is deferred so it does not immediately return on the first study day.
- Move: the moved topic is pinned to the chosen future date while the remaining capacity is recalculated around it.
- Manual rebalance: the student can ask Havan to rebuild the week from the current academic state.

## History

A new plan is created after replanning. The previous plan is retained as history.

Previous sessions with status RECOMMENDED are marked REPLANNED. COMPLETED and SKIPPED records remain unchanged.

This keeps the system auditable instead of silently rewriting what the student originally saw.

## API

POST /api/v1/planner/students/{student_id}/replan

POST /api/v1/planner/students/{student_id}/tasks/{task_id}/action

Task actions return the newly recalculated StudyPlan for COMPLETE, SKIP, and MOVE. START keeps the current plan because beginning a session does not require a schedule change.

## Scheduling behavior

The deterministic engine still respects:

- daily study capacity
- active study days
- prerequisite readiness
- exam urgency
- exam importance
- senior-student topic difficulty
- student confidence and progress
- estimated study time
- revision need

Dynamic controls add two scheduling signals:

- deferred topics are considered after normal recommendations
- pinned topics begin on their requested future date

No AI or ML is introduced in Phase 6.3.

## Product principle

Havan recommends. The student decides. The planner adapts to the decision.
