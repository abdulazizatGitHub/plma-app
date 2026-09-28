# Agent onboarding — read this first

## Product

**Personal Life Management & Tracking PWA** — habits, prayer/Quran, health, sleep, reading, university, tasks, goals, content creation, calendar, analytics. Offline SQLite + sync to Postgres.

**Requirements:** [docs/requirements/CLIENT_REQUIREMENTS.md](./docs/requirements/CLIENT_REQUIREMENTS.md)

## Document map

| Document | Purpose |
|----------|---------|
| [DECISION.md](./DECISION.md) | Decision log |
| [PROJECT.md](./PROJECT.md) | Blockers & bugs |
| [PROGRESS.md](./PROGRESS.md) | Phase/task status |
| [docs/standards/TECH_STACK.md](./docs/standards/TECH_STACK.md) | Stack |
| [docs/standards/CODING_STANDARDS.md](./docs/standards/CODING_STANDARDS.md) | Code conventions |
| [docs/standards/DATABASE_STANDARDS.md](./docs/standards/DATABASE_STANDARDS.md) | DB & sync |
| [docs/standards/IMPLEMENTATION.md](./docs/standards/IMPLEMENTATION.md) | PWA & UX rules |
| [docs/phases/README.md](./docs/phases/README.md) | Phase index |

## Current status

- **Active phase:** [Phase 03 — Shell & home](./docs/phases/phase-03-shell-home.md)
- **Database:** Supabase (session pooler) — see [DATABASE_SETUP.md](./docs/DATABASE_SETUP.md)
- **Stack:** Node + TS (Fastify), Next.js + TS, Tailwind, Postgres, SQLite (sql.js offline), Serwist PWA

## Phase links

1. [Foundation & PWA](./docs/phases/phase-01-foundation.md)
2. [Data & sync](./docs/phases/phase-02-data-sync.md)
3. [Shell & home](./docs/phases/phase-03-shell-home.md)
4. [Prayer & Quran](./docs/phases/phase-04-prayer-quran.md)
5. [Health](./docs/phases/phase-05-health.md)
6. [Reading, uni, custom habits](./docs/phases/phase-06-reading-uni-custom.md)
7. [Bed, no phone, plan tomorrow](./docs/phases/phase-07-personal-habits.md)
8. [Tasks & goals](./docs/phases/phase-08-tasks-goals.md)
9. [Content](./docs/phases/phase-09-content.md)
10. [Calendar](./docs/phases/phase-10-calendar.md)
11. [Analytics](./docs/phases/phase-11-analytics.md)
12. [Notifications & quick add](./docs/phases/phase-12-notifications-quickadd.md)
13. [Polish & deploy](./docs/phases/phase-13-polish-deploy.md)

## Workflow

Plan active phase → execute → update PROGRESS + phase acceptance criteria → DECISION on architecture changes → next phase.
