# Havan Study Planner

Production-oriented academic planning platform for Ethiopian university freshman students.

**The system recommends. The student decides.**

Architecture: Next.js frontend → REST API → FastAPI backend → planning services → PostgreSQL.

The existing planner UI, university catalog, curriculum preparation data, Telegram Mini App integration, and deterministic planning logic are preserved during the Vite-to-Next.js migration.

## Phase 0 / Phase 1

- Phase 0: architecture, boundaries, engineering rules, and migration strategy.
- Phase 1: Next.js frontend, FastAPI backend, SQLAlchemy, PostgreSQL configuration, Alembic, CORS, logging, error handling, health endpoint, and tests.
- Phase 2: curriculum and academic database.
- Phase 3+: admin, student data, planning intelligence, examination intelligence, personalization, and Havan content.

## Commands

Frontend: `npm install`, `npm run dev`, `npm run build`, `npm test`, `npm run lint`.

Backend: `cd backend`; create/activate a Python 3.12 virtual environment; `pip install -r requirements.txt`; copy `.env.example` to `.env`; `uvicorn app.main:app --reload`.

Health endpoint: `GET /health`.

Copy `frontend/.env.example` to `frontend/.env.local` and `backend/.env.example` to `backend/.env`. Never commit secrets.
