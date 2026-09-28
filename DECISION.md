# Decision log

Record **every significant project decision** here so future work (and agents) can understand *why* the codebase looks the way it does.

## How to write an entry

Use this template for each decision:

```markdown
### YYYY-MM-DD — Short title

- **Context:** What problem or question prompted this?
- **Decision:** What we chose.
- **Alternatives considered:** What we did not choose and why.
- **Consequences:** Trade-offs, follow-up work, or constraints.
- **Related:** Phase doc, PR, or issue reference if any.
```

---

## Pre-requirements (project setup)

### 2026-09-27 — Documentation-first phased delivery

- **Context:** Product owner requested a web PWA built in phases with traceable docs for agents and humans.
- **Decision:** Use root-level `AGENT.md`, `DECISION.md`, `PROJECT.md`, `PROGRESS.md`; phase specs under `docs/phases/`; standards under `docs/standards/`.
- **Alternatives considered:** Single README only (rejected — insufficient for multi-phase agent handoff); ADR folder per decision (deferred — one `DECISION.md` is enough until volume grows).
- **Consequences:** All agents must read `AGENT.md` first; decisions must not live only in chat.
- **Related:** [AGENT.md](./AGENT.md)

### 2026-09-27 — Tech stack deferred

- **Context:** Application functional requirements not yet provided.
- **Decision:** Do not scaffold application code or lock stack until requirements are received and recorded in phase documents.
- **Alternatives considered:** Default to Next.js + Postgres immediately (rejected — may not match constraints).
- **Consequences:** `docs/standards/TECH_STACK.md` remains in *pending* state until first stack decision after requirements.
- **Related:** [docs/standards/TECH_STACK.md](./docs/standards/TECH_STACK.md)

### 2026-09-27 — Approved tech stack (client)

- **Context:** Client specified Node/TS backend, Next/TS frontend, Postgres + SQLite offline sync, Tailwind.
- **Decision:** npm workspaces monorepo; Fastify API; Next.js App Router web; Drizzle + Postgres; browser SQLite via wa-sqlite (Phase 02); Tailwind; Serwist PWA.
- **Alternatives considered:** Next-only API routes (rejected for explicit separate backend); Prisma (rejected — Drizzle lighter for dual dialect); IndexedDB-only (rejected — client asked SQLite).
- **Consequences:** Two dev servers in Phase 01; sync complexity in Phase 02.
- **Related:** [TECH_STACK.md](./docs/standards/TECH_STACK.md)

### 2026-09-27 — Thirteen-phase delivery plan

- **Context:** Large CRD for personal life management PWA.
- **Decision:** Phases 01–13 from foundation through polish; requirements in `docs/phases/phase-NN-*.md`; CRD archived in `docs/requirements/CLIENT_REQUIREMENTS.md`.
- **Alternatives considered:** Single MVP blob (rejected — poor tracking); 20+ micro-phases (rejected — overhead).
- **Consequences:** Home dashboard shell in Phase 03 before all trackers exist; widgets fill in phases 04–09.
- **Related:** [AGENT.md](./AGENT.md), [PROGRESS.md](./PROGRESS.md)

### 2026-09-27 — Content nav placement

- **Context:** CRD §25 allows Content in main nav or Goals/More.
- **Decision:** Content under **Goals** tab with sub-nav; not a sixth bottom tab.
- **Alternatives considered:** Dedicated tab (deferred — keep five tabs).
- **Consequences:** Phase 03 Goals page includes Content entry.
- **Related:** Phase 03, Phase 09

### 2026-09-27 — Single-user sync v1

- **Context:** Personal app for one owner; cloud sync for multi-device.
- **Decision:** Schema supports `user_id`; v1 auth minimal (API key or session token in Phase 02).
- **Alternatives considered:** Full auth0 (deferred); local-only forever (rejected — client wants cloud sync).
- **Consequences:** Auth hardening in Phase 12/13 if needed.

### 2026-09-27 — API starts without DB; `/health/db` for readiness

- **Context:** Dev machines may not have Postgres reachable (port conflicts, cloud DB pending).
- **Decision:** Do not call `ensureDefaultUser()` on API boot; expose `GET /health/db` (503 when DB down); habit/sync routes still require DB on first use.
- **Consequences:** `npm run dev` works for UI; owner configures `DATABASE_URL` per [DATABASE_SETUP.md](./docs/DATABASE_SETUP.md).

### 2026-09-27 — Browser SQLite via sql.js (WASM)

- **Context:** Phase 02 requires offline SQLite in the PWA; wa-sqlite + OPFS needs extra Next/webpack WASM wiring.
- **Decision:** Use **sql.js** persisted to `localStorage` as the v1 offline store; same SQL schema shape as Postgres; migrate to OPFS/wa-sqlite if storage limits hit.
- **Alternatives considered:** wa-sqlite (preferred long-term — Phase 13 spike); IndexedDB-only (rejected — not SQLite).
- **Consequences:** ~5MB localStorage cap risk; document in PROJECT if user hits limits.
- **Related:** Phase 02

### 2026-09-27 — Supabase session pooler for DATABASE_URL

- **Context:** Direct Supabase host failed DNS/IPv6 from Node on Windows; user confirmed session pooler works.
- **Decision:** Document **session pooler** URI as default for `DATABASE_URL`; keep `npm run db:migrate:manual` fallback when `drizzle-kit migrate` fails.
- **Consequences:** SSL required for pooler/supabase hosts in `postgres()` client.

### 2026-09-27 — Postgres on host port 5434

- **Context:** Local 5432/5433 were in use or conflicted; host TCP to 5433 hit wrong Postgres (auth failed for `life` user).
- **Decision:** Docker Compose maps **5434:5432**; default `DATABASE_URL` uses port 5434; API loads `apps/api/.env` with `override: true`.
- **Alternatives considered:** Stop host Postgres (user-dependent).
- **Consequences:** README and `.env.example` use 5434; re-apply migrations after recreating container.

### 2026-09-27 — Next.js 16 build uses Webpack for Serwist

- **Context:** Next 16 defaults to Turbopack; `@serwist/next` injects webpack config and fails Turbopack production builds.
- **Decision:** `next dev --webpack` and `next build --webpack` in `apps/web`; service worker disabled in development (`disable: NODE_ENV === "development"`).
- **Alternatives considered:** `@serwist/turbopack` (deferred until stable); drop Serwist (rejected).
- **Consequences:** Slightly slower dev/build vs Turbopack; SW typed with `/// <reference lib="webworker" />` in `src/sw.ts`.
- **Related:** Phase 01, T-01-03

---

<!-- Add new decisions below this line, newest first within each phase or chronologically as preferred. -->
