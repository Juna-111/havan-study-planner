# Havan Study Planner

Production-oriented academic planning platform for Ethiopian university Freshman students.

**The system recommends. The student decides.**

## Current MVP architecture

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
Student Course Resolution
        ↓
Editable Study Planner

The course catalog contains all available courses. A university does not need to recreate a course just because it teaches that course in a particular semester.

The administrator's academic setup is intentionally simple:

1. Select the university.
2. Select the curriculum.
3. Select the stream.
4. Choose courses from the full catalog.
5. Place each course in Semester 1 or Semester 2.

Moving a course changes only its university semester mapping. Removing a mapping does not delete the course or its Course → Chapter → Topic content.

## MVP focus

- Student registration and academic onboarding.
- University, curriculum, and stream resolution.
- Direct university course-to-semester mapping.
- Canonical Freshman Course → Chapter → Topic content.
- Current chapter/topic position.
- Study availability and examination dates.
- Dynamic study-plan generation.
- Editable planner actions such as move, skip, add, reschedule, complete, and repeat.
- Havan-branded student and admin experiences.
- Reliable academic data import and validation.

## Data strategy

Current chapter, topic, curriculum, and course content is development/sample data.

The architecture is designed so real institutional course mappings and real academic content can be introduced later without redesigning the planner.

## Engineering commands

Frontend:

npm install
npm run dev
npm run build
npm test
npm run lint

Backend:

cd backend

Create/activate a Python 3.12 virtual environment, install requirements.txt, copy .env.example to .env, then run:

uvicorn app.main:app --reload

Health endpoint:

GET /health

Never commit secrets. Use the frontend and backend environment example files for local configuration.

## MVP principle

Keep the academic engine powerful internally, but keep the administrator experience simple.

The administrator should manage **which courses a university teaches in Semester 1 and Semester 2**, not internal resolver mechanics.
