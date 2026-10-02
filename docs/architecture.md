# Havan Study Planner Architecture

## Current MVP architecture

Havan separates national Freshman academic content from university-specific configuration.

```
National Freshman Course Registry
        ↓
National Freshman Curriculum Template
        ↓
University Curriculum Mapping
        ↓
University Stream Course Assignment
        ↓
University Overrides & Exceptions
        ↓
Student Course Resolution
        ↓
Editable Study Planner
```

### 1. National Freshman Course Registry

The registry is the canonical Course → Chapter → Topic hierarchy.

A national course is stored once with its academic content, including topic difficulty and planner-relevant metadata. Universities do not copy the same chapters and topics into separate course trees.

### 2. National Freshman Curriculum Template

A curriculum template defines which national courses belong to each semester and whether each course is required or elective.

Templates are versioned so a newer curriculum can coexist with an older version.

### 3. University Curriculum Mapping

A university curriculum can map to an active national Freshman template.

The mapping says which national template is the default academic baseline for that university curriculum.

### 4. Stream Course Assignment

Streams determine which template courses are available to students in that stream.

This keeps stream differences as configuration rather than duplicated academic content.

### 5. University Overrides & Exceptions

A university may have genuine local differences without copying the national content.

Supported exceptions include:

- add a local course
- remove an inherited course
- move a course between semesters
- change stream assignment
- override local course code/title/credit information
- use a local course when no national equivalent exists

The override stores the reason/source so local differences remain explicit and auditable.

### 6. Student Course Resolution

During onboarding and planning, Havan resolves the student's available courses from:

- university
- curriculum version
- stream
- national template
- stream assignments
- active university overrides

The student can optionally provide a current chapter/topic position. If no starting position is supplied, the course starts from the beginning.

### 7. Editable Study Planner

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

Current academic content is development/sample data. The architecture is designed so real institutional data can replace or extend the sample dataset without redesigning the national Freshman content model.

## Engineering principle

Keep the academic model powerful internally while keeping student and administrator workflows simple. Avoid duplicating national curriculum content unless a university has a genuine local exception.
