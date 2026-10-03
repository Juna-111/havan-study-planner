# Havan Study Planner Architecture

## Current MVP architecture

Havan keeps the academic content catalog separate from the university structure that says which courses are actually taught.

```
Course Catalog
    ↓
University
    ↓
Curriculum
    ↓
Stream
    ↓
University Course Mapping
    ↓
Semester 1 / Semester 2
    ↓
Student Course Resolution
    ↓
Editable Study Planner
```

### 1. Course Catalog

The course catalog contains every course available to Havan, regardless of whether a particular university teaches it in Semester 1, Semester 2, or not at all.

Freshman courses use the canonical Course → Chapter → Topic hierarchy. Universities do not copy that academic content when they use a course.

Course content remains independent from semester placement.

### 2. University curriculum

A university can have one or more curriculum versions. The curriculum identifies the academic structure students belong to.

Curriculum versions are kept so historical and newer institutional structures can coexist when necessary.

### 3. Stream

A curriculum can contain streams such as Natural Science or Social Science.

The stream identifies which university course mapping applies to the student.

### 4. University Course Mapping

The university course mapping is the single source of truth for semester placement.

For each university curriculum stream, an administrator selects courses from the full course catalog and places each course into:

- Semester 1
- Semester 2

A course is mapped at most once per stream. Moving a course means changing its semester. Removing a course removes only the university mapping; the course and its Course → Chapter → Topic content remain in the catalog.

There is no separate university-to-national template mapping, stream assignment layer, or university override layer in the active MVP architecture.

### 5. Student Course Resolution

During onboarding and planning, Havan resolves the student's available courses from:

- university
- curriculum
- stream
- active university course mappings

The resolver returns the effective course metadata and semester placement used by student course selection and the planner.

The student can optionally provide a current chapter/topic position. If no starting position is supplied, the course starts from the beginning.

### 6. Editable Study Planner

The planner uses deterministic academic inputs such as:

- topic difficulty
- estimated study time
- exam dates
- student availability
- progress
- prerequisites
- course context

The student remains in control through actions such as move, skip, add, reschedule, complete, and repeat.

AI/ML is not the source of truth for the MVP.

## Data policy

Current academic content is development/sample data. The real institutional course mappings and real Course → Chapter → Topic data can be loaded later without changing the core planner architecture.

## Engineering principle

Keep the academic model powerful internally while making the administrator's job simple:

**Find the university → choose the stream → put each course in Semester 1 or Semester 2.**

No administrator should need to understand resolver internals to perform ordinary academic setup.
