> Historical; not current.\n\n# Phases 6.84–6.86: Academic Mapping, Overrides, and Planner Integration

## 6.84 — Semester/Stream Course Mapping

A university stream receives Freshman courses through:

`Stream → FreshmanStreamCourseAssignment → FreshmanTemplateCourse → FreshmanTemplateSemester → National Course`

The assignment is valid only when the university curriculum has a matching Freshman mapping. An ACTIVE assignment requires an ACTIVE mapping and ACTIVE national template.

Semester and template order remain owned by the national template. A university stream chooses which template course placements apply to that stream.

## 6.85 — University Overrides

University overrides are applied after inherited national courses.

Supported override types:
- ADD
- REMOVE
- MOVE
- CHANGE_STREAM
- METADATA

MOVE changes the effective semester/order without copying the national course. ADD introduces a university-local course. REMOVE removes an inherited course. CHANGE_STREAM transfers an inherited course between streams. METADATA changes the effective local display code, title, or credit hours.

The resolver applies only ACTIVE overrides.

## 6.86 — Planner Integration

`backend/app/services/academic_resolver.py` is the authoritative course-resolution layer.

The effective flow is:

`Student → Stream → National Mapping → Stream Assignments → University Overrides → Resolved Courses → Chapters → Topics → Planner`

Student course eligibility and Freshman course discovery use the same resolver. Planner generation filters the student's selected courses against the resolved active curriculum before loading chapters and topics.

This prevents the planner from bypassing university mappings or overrides.

The planner remains deterministic and student-controlled. No machine learning is introduced.

## Validation boundary

These phases are considered ready for MVP validation only after backend tests and CI confirm:

- stream assignments resolve correctly
- MOVE changes placement
- REMOVE removes inherited courses
- ADD introduces local courses
- CHANGE_STREAM moves inherited courses between streams
- METADATA changes effective course display
- planner generation consumes only resolved active courses
- inactive mappings/assignments do not leak into student plans

Current academic and curriculum records remain sample data. Real curriculum data can be imported later through the canonical Freshman registry and template workflow.