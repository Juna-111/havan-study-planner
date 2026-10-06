# Havan Study Planner

Havan is a Havan-branded study planning platform for Ethiopian university Freshman students.

**The system recommends. The student decides.**

## Active flow

`/auth → /onboarding → /home → /plan → /plan/new → /progress → /settings`

Students choose the courses/topics and available time. The deterministic Plan engine organizes the selected work around study days, progress, and exams.

Admins use `/admin` to manage university course mapping, canonical course/chapter/topic content, imports, and academic quality.

## Data

Academic course, chapter, topic, curriculum, and mapping records are sample/development data for now. Real institutional data can be loaded later through the same catalog architecture.

## Run

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

## Verify

```bash
# backend
cd backend
pytest -q

# frontend
cd ..
npm run lint
npm test
npm run build
npm run check:structure
```

Read [docs/README.md](docs/README.md) for the current architecture and development guide.

Never commit secrets.
