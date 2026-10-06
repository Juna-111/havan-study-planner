> Historical; not current.\n\n# Phase 6.7 — Student Dashboard

## Goal

Create a simple student command center that gives the student an immediate view of progress, next academic pressure, selected courses, and quick access to the editable planner.

## Frontend principles

- Preserve Havan branding: Havan blue/red, existing typography, cards, borders, spacing, and visual hierarchy.
- Keep the first screen simple: welcome, progress, next exam, courses, and one primary action.
- Keep detailed management available through expandable sections instead of placing every control above the fold.
- Use responsive layouts designed for phones first, then expand for tablet and desktop.
- Keep actions directly connected to the existing student APIs and planner.

## Dashboard sections

1. Header
   - Havan identity
   - study capacity
   - compact student avatar

2. Welcome
   - personalized greeting
   - short explanation
   - primary "Open study plan" action

3. Overview KPIs
   - academic progress
   - topics in progress
   - courses
   - next exam countdown

4. Next Priority
   - upcoming exam
   - exam date
   - countdown
   - link to recommendations

5. Progress
   - completed study time
   - overall topic progress
   - direct link to update topic progress

6. Courses
   - selected courses
   - topic completion percentage
   - confidence
   - compact progress bars

7. Academic data status
   - clear warning when courses have no registered topics

8. Expandable management
   - exam date management
   - topic progress management

## Interactivity

Existing functionality is preserved:

- Add, edit, and remove exams.
- Update topic progress.
- Open the editable study planner.
- Dismiss errors.
- Expand/collapse detailed management sections.

## Responsive behavior

Desktop:
- multi-column KPI and focus layouts
- three-column course cards
- two-column management panels

Tablet:
- reduced KPI columns
- two-column course cards
- stacked management panels

Mobile:
- one-column focus and course layout
- touch-friendly actions
- compact header
- no horizontal overflow
- expandable management sections
- typography and spacing scaled down without removing information

## Architecture

No new backend API is required for 6.7.

The dashboard derives its summaries from the existing student context:

- profile
- registered courses
- active topics
- topic progress
- exam dates

The editable planner remains the detailed planning surface.

## Status

Implementation complete pending CI verification.
