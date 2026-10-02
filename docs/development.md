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
npm run build
npm run lint
npm test
```

## Backend

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment, then:

```bash
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

## Database

Create the `havan_study_planner` database and set `DATABASE_URL` in the backend environment.

Run migrations from `backend`:

```bash
alembic upgrade head
```

The active Alembic configuration uses:

```text
backend/database/migrations
```

Historical migrations are retained because they define the database upgrade path. New schema changes must be added as new migrations rather than rewriting old migration files.

## MVP data workflow

Use the focused admin workspaces for:

1. University setup
2. National Freshman registry
3. National Freshman curriculum templates
4. University curriculum mapping
5. Stream course assignments
6. University overrides and exceptions
7. Academic quality review

Do not reintroduce a generic full-tree University → Curriculum → Stream → Course → Chapter → Topic importer. National Freshman content should be imported into the canonical registry, then reused through templates and university mappings.

Current academic records are sample/development data. Real curriculum data can be introduced later through the same canonical workflows.

## Verification

For a full CI-style check:

```bash
cd backend
pytest -q

cd ../frontend
npm run lint
npm test
npm run build
```

Never commit secrets. Use the environment example files for local configuration.
