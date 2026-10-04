# New Havan Planner

The new planner is intentionally separate from the existing planner.

## Modes

- Havan Today: one-day plan.
- Havan Week: seven-day plan with selected study days and hours per day.
- Havan Month: monthly plan using the same planning model.

## Product rule

The student chooses the course, chapter, topics, and available time. Havan organizes that selected workload. It does not replace the student's choice with a recommendation engine.

## Current implementation

- Uses existing Course -> Chapter -> Topic APIs.
- Uses topic estimated study minutes for proportional time allocation.
- Keeps the previous planner at /student/planner.
- New planner is available at /student/havan.
- Academy resource buttons are prepared for real content mapping.
- Freshman question count is intentionally left as a data field to connect to the question platform when that mapping is available.
- Topic relationships are not used.

## Next integration

Add persistent new-plan APIs and resource/question mappings after the UI is validated with students.