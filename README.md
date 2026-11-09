# Mehrmah

A personal life-management PWA: prayers, habits, tasks and plans in one place. Each day is summed up by three rings: **Prayer**, **Commitments** and **Balance**. Friends and groups help you keep going. It works offline and syncs when you're back online.

- **Preprod:** <https://mehrmah.vercel.app> (API: <https://mehrmah-api.onrender.com/health>)
- **How the app works, for users:** [docs/guides/USER_GUIDE.md](./docs/guides/USER_GUIDE.md). The same text is the in-app **App guide**.
- **Project docs, for contributors and agents:** start at [AGENT.md](./AGENT.md).

## What's inside

```text
apps/web          Next.js 16 PWA (React 19, Tailwind 4, Serwist): offline store on sql.js, synced to the API
apps/api          Fastify 5 API: sync, rewards, friends and snaps, groups, reminders (Web Push), day closing
packages/shared   TypeScript and Zod: entities, scheduling, rings, points, awards; shared by web and API
docs/             requirements, phases, standards, guides, email templates, QA
scripts/          preprod secrets, smoke and end-to-end checks, secret scan
```

- **Sign-in:** Supabase Auth with an email code (6 digits).
- **Data:** Postgres on Supabase, with migrations in `apps/api/drizzle`. Every table has row-level security; the browser only talks to our API.

## Getting started

Needs **Node.js 22** and npm.

```bash
npm install
cp .env.example .env.local      # in the repo root; fill it in (placeholders only in the example)
npm run db:migrate:manual -w @life/api
npm run dev                     # web on http://localhost:3000, API on http://localhost:4000
```

- [docs/guides/AUTH_SETUP.md](./docs/guides/AUTH_SETUP.md) explains where each Supabase value comes from.
- `npm run db:seed:templates -w @life/api` adds the plan presets (optional).
- Never commit `.env*` files with real values. They're git-ignored; only `.env.example` is tracked.

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Web and API together (or `dev:web` / `dev:api`) |
| `npm run verify` | Typecheck, lint, all tests, and a production dependency audit. The pre-push hook runs this. |
| `npm test` | Unit and component tests (Vitest), with the timezone pinned to Asia/Karachi |
| `npm run build` | Builds shared, API and web |
| `npm run docs:guide -w web` | Regenerates `USER_GUIDE.md` from the in-app guide (`apps/web/src/lib/help/content.ts`) |
| `npm run jobs:finalize -w @life/api` | Runs the end-of-period jobs (group goals, podiums) once |

## Branches and deploys

- Work on `feature/*` or `fix/*`, then merge `--no-ff` into **`dev`**.
- Release with **`dev` → `preprod`**.
- CI runs lint, typecheck, tests, build, the audit and a secret scan on every push to `dev`, `preprod` and `main`. See [BRANCHING_AND_CI.md](./docs/guides/BRANCHING_AND_CI.md).

| | Where | From |
| --- | --- | --- |
| Web | Vercel, project `mehrmah` (Root Directory `apps/web`; installs from the repo root via `apps/web/vercel.json`) | branch `preprod` |
| API | Render, service `mehrmah-api` (`apps/api/Dockerfile`), kept awake by a cron-job.org ping | branch `preprod` |
| Database and sign-in | Supabase project **PLMA-preprod-app**, with Gmail SMTP and the code email templates | — |

The full setup, the env vars per host, and troubleshooting are in [docs/guides/DEPLOY_PREPROD.md](./docs/guides/DEPLOY_PREPROD.md). After a deploy:

```bash
node scripts/smoke-preprod.mjs   # 10 checks: API, database, CORS, HTTPS, PWA files, build points at the API
node scripts/e2e-preprod.mjs     # 34 end-to-end checks with throwaway accounts (deleted afterwards)
```

Both read `.env.preprod.local` (git-ignored; create it with `node scripts/preprod-secrets.mjs`). Migrations for preprod run with `ENV_FILE=.env.preprod.local npm run db:migrate:manual -w @life/api`.

## Status

- [PROGRESS.md](./PROGRESS.md): what's built and verified.
- [DECISION.md](./DECISION.md): why things are the way they are.
- [PROJECT.md](./PROJECT.md): open bugs.
- [docs/qa/PREPROD_QA.md](./docs/qa/PREPROD_QA.md): preprod findings and the test plan.
