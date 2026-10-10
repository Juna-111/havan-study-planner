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


## Deployment environment

Vercel builds the static export from the repository root:
- `NEXT_PUBLIC_API_URL=https://<api-origin>`
- `NEXT_PUBLIC_SITE_URL=https://<frontend-origin>`
- Build output: `frontend/out`

Backend production requires:
- `ENVIRONMENT=production`
- `DATABASE_URL`
- `AUTH_SECRET` with at least 32 random characters
- `CORS_ORIGINS=https://<vercel-origin>` with exact origins and no trailing slash
- `ADMIN_EMAILS`
- `AUTH_TOKEN_TTL_DAYS`
- `DEFAULT_TIMEZONE=Africa/Addis_Ababa`
- `RESEND_API_KEY` and `EMAIL_FROM` for password recovery on Render Free. Verify the sender domain with the email provider before production.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` are optional for local development or hosts that permit SMTP egress. Render Free blocks outbound SMTP ports 25, 465, and 587, so do not configure SMTP as its only delivery route.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` for browser push reminders. Generate a key pair once with `python scripts/generate_vapid_keys.py` from `backend/`; keep the private key in the backend secret store and use the same pair across deployments.

The API reminder loop runs once per minute. PostgreSQL advisory locking ensures only one API process dispatches reminders when the service has multiple workers or instances. Push delivery requires an HTTPS frontend origin and students must grant browser notification permission; browser vendors and device settings can still suppress delivery.

The frontend build requires network access because `next/font/google` downloads fonts during build.
