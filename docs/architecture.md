# Havan Study Planner Architecture

## Phase 0
Havan Study Planner is an academic intelligence platform, not merely a calendar. Long-term inputs include university, curriculum, stream, course, chapter, topic, difficulty, time, prerequisites, cross-course relationships, exams, progress, confidence, and capacity.

**The system recommends. The student decides.**

## Phase 1
Next.js frontend → REST/JSON → FastAPI → SQLAlchemy → PostgreSQL.

The existing deterministic planner remains intact during migration. AI/ML is not the source of truth and is introduced only after deterministic foundations and sufficient real data.
