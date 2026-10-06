> Historical; not current.\n\n# Phase 6.1 — Planner UX

## Goal

Turn the Phase 5 deterministic recommendation output into a responsive student workspace that answers:

> What should I study, when should I study it, and why is Havan recommending it?

Phase 6.1 is presentation and navigation. It does not change planner scoring or task state.

## Student experience

The planner now provides:

- A personalized weekly hero with available daily capacity.
- A compact weekly overview for scheduled minutes, recommendations, completed sessions, and the next exam.
- A seven-day navigation strip.
- A focus view for the selected day.
- A daily agenda with course filtering.
- A recommendation detail drawer showing the topic, duration, priority, reason, senior difficulty, exam importance, planned date, and current plan status.
- Upcoming exam context.
- Course scope and quick filtering.
- Loading, error/retry, and empty states.
- Mobile-specific layouts instead of simply shrinking the desktop layout.
- Keyboard-visible focus states inherited from the student design system.
- Reduced-motion support.

## Product boundary

Phase 6.1 does not mutate study tasks.

The following remain Phase 6.2 responsibilities:

- Complete.
- Skip.
- Move.
- Reschedule.
- Start/stop study state.
- Dynamic replanning after task changes.

This keeps recommendation display separate from task-state mutation while the product model is still being established.

## Design principles

1. Recommendation first. The first visible information is the current academic focus.
2. Explainability. A student can inspect why a recommendation exists.
3. Low cognitive load. The week is navigable without forcing the student to scan a long task list.
4. Responsive by intent. Desktop uses a two-column workspace; mobile becomes a focused vertical flow.
5. Accessible interaction. Interactive dates and recommendation cards use semantic buttons and selected states.
6. Honest system boundaries. The interface does not pretend Phase 6.2 actions already exist.

## Data sources

The page uses existing Phase 5 and Phase 4 APIs only:

- Student profile/context.
- Selected courses.
- Active curriculum topics.
- Generated study plan.
- Current exam dates.

No database migration is required for Phase 6.1.
