# Phase 6.8 Testing Checklist

## Purpose

Use this file to validate the Havan Study Planner academic-quality feature before moving to Phase 6.9 MVP validation.

Important: the current curriculum, chapters, topics, and curriculum versions are **sample data**. This test validates the product behavior and data-quality rules, not the academic correctness of those sample records.

## 1. Automated backend tests

From the repository root:

```bash
cd backend
pytest -q
```

Expected:

- All tests pass.
- Academic-quality tests cover missing content.
- Invalid topic planner values are detected.
- Inactive parent chains are detected.
- Prerequisite cycles are detected.
- A complete sample course can be marked planner-ready.
- Duplicate relationships are detected.

## 2. Frontend verification

```bash
cd frontend
npm run lint
npm test
npm run build
```

Expected:

- Lint passes.
- Frontend tests pass.
- Production build completes without TypeScript errors.

## 3. API smoke test

With the backend running:

```text
GET /api/v1/academic-quality
```

Expected response contains:

- `summary`
- `counts`
- `readiness`
- `issues`

The readiness object should contain:

- `status`
- `active_courses`
- `ready_courses`
- `active_topics`
- `invalid_topics`
- `prerequisite_cycle_topics`

## 4. Admin UI smoke test

Open the Havan admin Academic Quality workspace.

Verify:

- The page loads without a frontend error.
- Havan branding is visible.
- Academic health is shown.
- Planner readiness is shown.
- Error, warning, info, and record totals are visible.
- Academic record counts are visible.
- The All/Error/Warning/Info filters work.
- Refresh checks reloads the data.
- Issue cards show entity type and entity ID.
- Empty-state messaging appears when a selected severity has no issues.
- The page remains usable on mobile width.

## 5. Missing-content tests

Create or use sample records with these states:

### University without active curriculum

Expected:

`Missing academic content` warning for the university.

### Active curriculum without active stream

Expected:

`Missing academic content` warning for the curriculum.

### Active stream without active course

Expected:

`Missing academic content` warning for the stream.

### Active course without active chapter

Expected:

`Missing academic content` warning for the course.

### Active chapter without active topic

Expected:

`Missing academic content` warning for the chapter.

## 6. Inactive-parent tests

Create an active child under an inactive parent.

Test:

- active curriculum → inactive university
- active stream → inactive curriculum
- active course → inactive stream
- active chapter → inactive course
- active topic → inactive chapter

Expected:

An error explaining that the active record has an inactive or missing parent.

## 7. Topic validation tests

Test an active topic with:

- empty name
- study time `0`
- negative study time
- difficulty below `1`
- difficulty above `5`
- exam importance below `0`
- exam importance above `1`
- conceptual importance below `0`
- conceptual importance above `1`

Expected:

Each invalid value produces a clear academic-quality issue.

## 8. Topic ordering test

Create two active topics in the same chapter with the same `order_index`.

Expected:

A warning identifies the chapter and duplicate order value.

## 9. Relationship tests

Test:

- duplicate prerequisite relationship
- self-referencing relationship
- missing source topic
- missing target topic
- strength below `0`
- strength above `1`
- unsupported relationship type

Expected:

The quality report identifies the relationship problem.

## 10. Prerequisite-cycle test

Create:

```text
Topic A → prerequisite → Topic B
Topic B → prerequisite → Topic A
```

Expected:

- Both topics are reported as participating in a prerequisite cycle.
- Planner readiness becomes `error`.

For a longer cycle:

```text
A → B
B → C
C → A
```

Expected:

All cycle participants are identified.

## 11. Planner-readiness tests

### Ready

Use an active course with:

- active chapter
- active topic
- valid topic values
- credit hours

Expected:

`readiness.status = ready`

### Warning

Use an active course with missing usable chapter/topic content but no invalid topic values or prerequisite cycle.

Expected:

`readiness.status = warning`

### Error

Use invalid topic values or a prerequisite cycle.

Expected:

`readiness.status = error`

## 12. Sample-data replacement test

This is important for the actual Havan rollout.

Replace or add sample curriculum records with a different university/curriculum version/course/topic structure.

Expected:

- No planner code changes are required.
- Academic Quality reads the new records automatically.
- Counts update.
- Issues update.
- Planner readiness reflects the new dataset.

The quality system must validate data, not depend on specific sample IDs or names.

## 13. Phase 6.8 completion criteria

Phase 6.8 is considered functionally complete when:

- [ ] Academic-quality API responds.
- [ ] Hierarchy checks work.
- [ ] Inactive-parent checks work.
- [ ] Topic value checks work.
- [ ] Relationship checks work.
- [ ] Prerequisite-cycle checks work.
- [ ] Planner readiness is reported.
- [ ] Admin UI displays the results.
- [ ] Filters and refresh work.
- [ ] Automated backend tests pass.
- [ ] Frontend lint passes.
- [ ] Frontend tests pass.
- [ ] Production build passes.
- [ ] Sample data is treated as replaceable test data.
- [ ] No planner recommendation/ranking logic was changed by Phase 6.8.

## 14. Production follow-up

Before a real production launch, add:

- admin authentication and authorization for the academic-quality endpoint
- audited curriculum import/update workflows
- validation during real curriculum import
- real academic-data review by authorized academic staff

These are production hardening tasks, not reasons to treat the current sample curriculum as final data.
