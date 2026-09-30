# Havan Plan Creator

A study planner for Ethiopian freshman students, built as a Telegram Mini App with a
browser fallback. Students pick their university and stream, Havan pre-fills the courses
freshmen actually take there, and the app generates an editable weekly plan with
Keep-Up / Catch-Up / Exam recommendations.

## Stack

- React 19 + TypeScript + Vite
- Vitest for unit tests, Oxlint for linting
- No backend yet: plans are stored per profile in `localStorage`

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check and build for production
- `npm test` — run unit tests
- `npm run lint` — run Oxlint
- `npm run preview` — preview the production build

## Project structure

- `src/App.tsx` — session page, onboarding flow, planner UI
- `src/domain/plan.ts` — plan generation, recommendations, catalog/prep lookups,
  university search (all UI-independent logic lives here)
- `src/domain/plan.test.ts` — unit tests for the domain logic
- `src/lib/telegram.ts` — Telegram Mini App integration
- `src/lib/session.ts` — profile identity and localStorage persistence
  (`havan-study-planner-v3:<id>`, with legacy `v2` keys read transparently)
- `src/data/universities.ts` — AUTO-GENERATED from `Freshman and COC info 2018 E.C.xlsx`
- `src/data/curriculum.ts` — AUTO-GENERATED from `HAVAN ACADEMY study plan.docx`
  (30-day prep program, days 26–28 are health-track only)

The two files in `src/data/` are generated from client documents. Do not edit them by
hand unless you are fixing a conversion error — regenerate from the source documents
instead.

## Deployment

The app is deployed on Vercel from this repository.

## Security notes

Telegram user data shown in the app is display-only client data. It must not be used to
authorize protected resources. If a backend is added, Telegram `initData` must be
validated server-side with the bot token, and sessions must use HttpOnly cookies.
