# Development

## Requirements

- Node.js 20.9+
- Python 3.12+
- PostgreSQL 16+ recommended

## Frontend

From the repository root:

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
npm run check:structure
```

## Backend

```bash
cd backend
python -m venv .venv
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Run migrations:

```bash
alembic upgrade head
```

Run tests:

```bash
pytest -q
```

## Environment

Never commit secrets. Use `backend/.env.example` and the frontend environment configuration for local values. Production requires a non-default authentication secret.

## Verification order

1. `alembic upgrade head` on a clean database.
2. Backend `pytest -q`.
3. Frontend lint, type check, tests, production build.
4. `npm run check:structure`.
5. Manual review at 320, 360, 390, 768, 1024, and 1280 px.

The GitHub workflow performs the automated subset. A phase is not considered GREEN merely because code was committed.
