# Agent onboarding — read this first

## Product

**Personal Life Management & Tracking PWA** — habits, prayer/Quran, health, sleep, reading, university, tasks, goals, content creation, calendar, analytics. Offline SQLite + sync to Postgres.

**Requirements (v2, current):** [docs/requirements/REQUIREMENTS_V2.md](./docs/requirements/REQUIREMENTS_V2.md). It supersedes the original CRD where they conflict.
**Original CRD:** [docs/requirements/CLIENT_REQUIREMENTS.md](./docs/requirements/CLIENT_REQUIREMENTS.md)

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
| [docs/product/PRD.md](./docs/product/PRD.md) | v2 product requirements |
| [docs/architecture/SYSTEM_DESIGN.md](./docs/architecture/SYSTEM_DESIGN.md) | v2 architecture, data model, diagrams |
| [docs/plan/DEVELOPMENT_PLAN.md](./docs/plan/DEVELOPMENT_PLAN.md) | v2 phases and releases |
| [docs/design/DESIGN_SYSTEM_V2.md](./docs/design/DESIGN_SYSTEM_V2.md) | v2 visual tokens and components |

## Current status

- **Branch:** `v2`. Phases 0–2 are done (docs, UI kit, accounts/schema/sync, Today). **Next:** [v2 Phase 3 — Categories and items](./docs/phases/v2/phase-03-categories-items.md).
- **Product direction (2026-10-07):**
  - a simple UI from `UI Images/`
  - Today shows To Do / In Progress / Done
  - user-defined categories and items
  - flexible days (skip / move / pending; 100% still reachable)
  - prayer anchors, plans, reminders, and rewards
  - social features later
- **Database:** Supabase (session pooler); see [DATABASE_SETUP.md](./docs/DATABASE_SETUP.md)
- **Stack:** Node + TS (Fastify), Next.js + TS, Tailwind, Postgres, SQLite (sql.js offline), Serwist PWA. Adding in v2: Supabase Auth, pg-boss, web-push, adhan-js.

## Phase links

**Done (v1):**

1. [Foundation & PWA](./docs/phases/phase-01-foundation.md)
2. [Data & sync](./docs/phases/phase-02-data-sync.md)
3. [Shell & home](./docs/phases/phase-03-shell-home.md)
4. [Prayer & Quran](./docs/phases/phase-04-prayer-quran.md)
5. [Health](./docs/phases/phase-05-health.md)

**v2 (current plan):** [docs/phases/v2/](./docs/phases/v2/README.md)

**Superseded v1 phases 06–14:** [docs/phases/archive/](./docs/phases/archive/)

## Workflow

Plan active phase → execute → update PROGRESS + phase acceptance criteria → DECISION on architecture changes → next phase.
