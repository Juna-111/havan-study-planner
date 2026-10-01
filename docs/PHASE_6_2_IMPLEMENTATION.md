# Phase 6.2 — Execution Workspace

Phase 6.2 turns the recommendation page into an execution product.

## Student experience

- Start a recommended topic in a 25-minute Focus Mode.
- Complete a session and record topic progress as COMPLETED.
- Skip a session explicitly.
- Move one session to a future date without silently moving other sessions.
- See an action-impact explanation before changing a recommendation.
- Receive immediate confirmation after each action.

## Product principle

Havan recommends. The student decides.

Task actions are explicit user decisions. Phase 6.3 will own dynamic replanning of the remaining schedule after those decisions.

## API

POST /api/v1/planner/students/{student_id}/tasks/{task_id}/action

Actions: START, COMPLETE, SKIP, MOVE. MOVE requires target_date.

COMPLETE also updates the student's topic progress.

## Product loop

Plan → Study → Record → Adjust → Continue.

The product deliberately avoids silent schedule changes. Every action is visible and attributable to the student's choice.

## Scope boundary

No new database migration is required. Existing StudyTask.status stores execution state and StudentTopicProgress stores academic progress.

Dynamic schedule repair, workload redistribution, and automatic recovery belong to Phase 6.3.