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

### 2026-09-28 — Git repo initialized; sql.js browser WASM postinstall fixed

- **Context:** Repo had no version control despite phases 01–02 shipped. Separately, verifying Phase 03 acceptance in a real browser found the home dashboard stuck permanently on "Loading habits…" — `getLocalDb()` never resolves.
- **Decision:** `git init` + baseline commit of current tree. Root-caused the hang: webpack resolves `sql.js`'s `browser` export condition to `dist/sql-wasm-browser.js`, whose glue code fetches `sql-wasm-browser.wasm`, but `apps/web/package.json`'s `postinstall` only copied `dist/sql-wasm.wasm` into `public/`. Fixed by copying both wasm variants.
- **Alternatives considered:** Force sql.js import to resolve to the non-browser build instead (rejected — fights the bundler's default resolution, more fragile long-term).
- **Consequences:** Anyone who already ran `npm install` before this fix needs to rerun `npm run postinstall -w web` (or reinstall) to pick up `public/sql-wasm-browser.wasm`.
- **Related:** Phase 03, PROJECT.md BUG-001

### 2026-09-28 — Testing/lint/typecheck infra; Phase 04 prayer & Quran

- **Context:** No test runner, no lint config outside `apps/web`, and `tsc --noEmit` was doubling as "lint" — no rule actually enforced "no `any`" or caught unused/type errors distinctly from a lint pass. Phase 04 (CRD §2–3) needed prayer/Quran logging + a monthly report.
- **Decision:**
  - **Vitest**, one root `vitest.config.ts` with per-workspace projects (`shared`/`api` on `node`, `web` on `jsdom` + React Testing Library). Each workspace gets its own `test` script; root `npm test` runs all.
  - **ESLint**: root `eslint.config.mjs` (typescript-eslint, `no-explicit-any: error`) covers `apps/api` + `packages/shared`; `apps/web` keeps its own `eslint-config-next` config with the same `no-explicit-any` rule added. `lint` (eslint) and `typecheck` (`tsc --noEmit`) are now separate scripts per workspace, not aliased to each other.
  - **Phase 04 data model:** prayer/Quran are ordinary `habit_definitions` rows (slugs `prayer`, `quran-mulk`, `quran-kahf` — already seeded in Phase 02) logged through the existing generic `habit_logs` sync path. No new API routes or tables — matches DATABASE_STANDARDS.md's "dedicated tables optional" note. Payload shapes (`prayerLogPayloadSchema`, `quranLogPayloadSchema`) and the pure aggregation (`computeMonthlyPrayerReport`, `isFriday`) live in `packages/shared` so client and any future server-side stats endpoint share one validated, tested implementation.
- **Alternatives considered:** Dedicated `prayer_logs`/`quran_logs` Postgres tables (deferred — no proven need yet, would duplicate the sync plumbing); Jest instead of Vitest (rejected — Vite/Next-native tooling, faster, no extra transform config); component tests for every screen (deferred — reserved for components with real interaction logic like `PrayerTracker`; static shells stay covered by typecheck + lint only).
- **Consequences:** New free-text fields must validate through a shared Zod schema (see `validateCustomHabitName`) rather than ad hoc checks. `apps/web/vitest.setup.ts` registers RTL's `cleanup()` — any new component test file gets it for free via the shared setup.
- **Related:** Phase 04, docs/phases/phase-04-prayer-quran.md

---

<!-- Add new decisions below this line, newest first within each phase or chronologically as preferred. -->
