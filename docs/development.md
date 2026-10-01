# Development

Requirements: Node.js 20.9+, Python 3.12+, PostgreSQL 16+ recommended.

Frontend: npm install && npm run dev.

Backend: cd backend; python -m venv .venv; activate it; pip install -r requirements.txt; copy .env.example .env; uvicorn app.main:app --reload.

Database: create havan_study_planner and set DATABASE_URL. Run alembic upgrade head from backend when migrations exist.
