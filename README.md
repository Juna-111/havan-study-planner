# Havan Study Planner

Production-oriented academic planning platform for Ethiopian university Freshman students.

**The system recommends. The student decides.**

## Current MVP architecture

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

The national Course → Chapter → Topic hierarchy is the canonical Freshman content source. Universities reuse that content through mappings and stream assignments instead of uploading duplicate copies of the same national courses.

University-specific differences are represented through explicit overrides or local courses when a national equivalent does not exist.

## MVP focus

- Student registration and academic onboarding.
- University, curriculum, and stream resolution.
- National Freshman course resolution.
- Current chapter/topic position.
- Study availability and examination dates.
- Dynamic study-plan generation.
- Editable planner actions such as move, skip, add, reschedule, complete, and repeat.
- University-specific academic exceptions.
- Havan-branded student and admin experiences.
- Reliable academic data import and validation.

## Data strategy

Current chapter, topic, curriculum, and course content is development/sample data.

The architecture is designed so real institutional data can be introduced later without redesigning the national Freshman content model.

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

Keep the academic architecture powerful internally, but keep the student and administrator experience simple.

Avoid duplicating national curriculum data for individual universities unless the university has a genuine local exception.
