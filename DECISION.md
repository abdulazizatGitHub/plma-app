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

### 2026-09-30 — Multi-user accounts and per-user customization (supersedes "Single-user sync v1")

- **Context:** The owner confirmed the app is for **multiple people with their own accounts**, and that nothing (habits, goals, targets, Home, detail pages) should be the same for everyone. The code assumed one built-in "Owner":
  - all 9 system habits are auto-seeded
  - Home is a hardcoded list
  - custom habits never appear on Home
- **Decision:**
  - **Accounts first (Phase 06A).** Identity comes from a verified session. All data is scoped by user, and sync push must verify ownership of every referenced habit.
  - **Customization next (Phase 06B).** New users start empty and pick from a template catalog or create their own. Home and detail pages render the user's own habits. Users can save private templates.
  - **Template library later (Phase 14),** with the owner's rules recorded as LIB-01…05 in CLIENT_REQUIREMENTS Addendum A. **Provenance is stored from 06B onward** so the "no republishing adopted templates" rule (LIB-04) can be enforced when publishing ships.
  - Original Phase 06 (reading/university/custom habits) folds into 06B; reading and university become templates on the same engine.
- **Alternatives considered:**
  - Single owner with full customization (rejected by owner).
  - Keeping the 9 defaults pre-added and removable (rejected; users start empty and choose).
- **Consequences:**
  - Supersedes the 2026-09-27 "Single-user sync v1" decision.
  - `ensureDefaultUser` and the shared `SYNC_API_KEY` stop being the identity mechanism.
  - The existing Owner's data is kept and claimable.
  - Auth provider choice is pending owner input.
- **Related:** [phase-06a-accounts.md](./docs/phases/archive/phase-06a-accounts.md), [phase-06b-customization.md](./docs/phases/archive/phase-06b-customization.md), [phase-14-template-library.md](./docs/phases/archive/phase-14-template-library.md) (archived 2026-10-07; folded into v2)

### 2026-09-30 — Phase 05 health: payloads, sleep dating, goals in definition config

- **Context:** Phase 05 (steps, water, exercise, sleep) needed log shapes, week/month stats, and editable goals. Sleep crosses midnight, and goals had to be configurable in-app (CRD: "configurable without redeploy").
- **Decision:**
  - **No new tables.** Health habits use the generic `habit_logs.payload` path, like prayer/Quran. Zod payload schemas and all aggregations live in `packages/shared/src/health-tracking.ts`, so any future server-side stats share one tested implementation.
  - **Sleep** is `{ bedAt, wakeAt }` in UTC instants (per IMPLEMENTATION.md), **logged on the wake-up date**. So "today's sleep" means last night. A bedtime later on the clock than the wake time is placed on the previous day.
  - **Goals** (steps `goal`, water `goal`, sleep `wakeGoal`) live in `habit_definitions.config` and are edited via a new `updateLocalDefinitionConfig`. It queues the definition through the existing push, which already upserts `config`, so no API change was needed.
  - **Weeks start Monday** for stats. The 7-day bar charts are rolling ("Last 7 days").
  - **Sleep counts toward daily completion** once it's logged. The Home exercise toggle preserves duration/type.
  - The file was named `health-tracking.ts` because `health.ts` is already the API health-check schema.
- **Alternatives considered:**
  - A dedicated `sleep_logs` table (deferred; no stats-performance need yet).
  - Storing sleep as local `HH:MM` strings (rejected; it violates the UTC-instant standard and is ambiguous across DST).
  - A per-user settings table for goals (rejected; definition config already syncs).
- **Consequences:** Editing past nights and days waits for the Calendar day detail (Phase 10). Phase 11 analytics should reuse `summarizeCounter` / `summarizeExercise` / `summarizeSleep`.
- **Related:** [phase-05-health.md](./docs/phases/phase-05-health.md)

### 2026-09-30 — Research-derived redesign: palettes, type, tile Home, explicit Prayer actions

- **Context:** Owner rejected two incremental passes as visually unchanged. Their specific complaints: invented accent colors, the Fraunces serif, side color bars on cards, unclear actions, a hidden tap-to-cycle prayer interaction, and a progress ring that was invisible in dark mode. The research in `docs/design-references/` (10 award-winning sites, tokens extracted from their shipped CSS) was supposed to drive the design and hadn't.
- **Decision:**
  - **Palettes come from extracted tokens, not invention.** The four presets replace rose/slate/sage/lavender:
    - `clay` (default): by-kin
    - `volt`: Lusion
    - `studio`: Iventions
    - `ember`: Minh Pham

    Values marked `(d)` in `globals.css` are derived only where WCAG AA required it. A new `--accent-text` token is the AA-safe accent for text; `--accent` is for fills only.
  - **Category chips:** fixed pastels (Iventions ×4, Bruno Simon ×2, Lusion ×1) with dark `--cat-ink` icons, identical in every preset and mode.
  - **Type:** Space Grotesk for UI/display and Space Mono for uppercase labels. Geist and Fraunces are removed.
  - **Never use side color bars** (`border-l-*` accents) on cards. Category is shown by the chip; a completed tile fills with its pastel.
  - **Home:**
    - a large daily `ProgressRing` plus 7-day `WeeklyBars`
    - an "Up next" card with one primary action
    - numbered sections (`01/ FAITH`, …) of 2-column tiles, each with a labelled ≥44px action
  - **Prayer page:**
    - a large 5-segment ring (prayed/missed/pending), a streak chip, and weekly bars
    - "Next up" with Prayed/Missed buttons
    - an explicit per-prayer list with Prayed/Missed/Undo, replacing tap-to-cycle
    - a month heatmap with a legend
- **Also fixed:**
  - `/` is statically prerendered, so the server-computed date froze at build time. The date is now computed client-side.
  - `ThemeProvider` read localStorage during render, which caused a hydration mismatch (the wrong mode showed as selected). It now reads storage after mount.
  - Prayer buttons stayed enabled during an in-flight save, so a second tap built its payload from stale state and overwrote the first. All prayer controls now lock while a save is pending.
  - Saves no longer await the cloud sync: the local write shows immediately and sync runs in the background.
- **Alternatives considered:** Keeping the presets and only restyling (rejected by owner). A single fixed palette (rejected, since it removes the theme picker). A 2-column list with inline actions instead of tiles (owner chose tiles).
- **Consequences:** Stored `life_theme_name` values from the old presets are no longer valid and fall back to `clay` (validated in both `ThemeProvider` and the pre-paint init script). `DotCluster` and `StatNumber` were removed as unused.
- **Related:** `docs/design-references/INDEX.md`, `apps/web/src/app/globals.css`

### 2026-10-07 — v2: reconcile new owner requirements; keep foundation, replace domain and UI

- **Context:** The owner rejected the current UI and typography as not simple. They supplied 4 reference images (`UI Images/`) and a broader vision:
  - Today shows To Do / In Progress / Done.
  - Categories and items are user-defined.
  - Days are flexible: skip, move, or mark pending, and 100% is still reachable.
  - A custom prayer block, with items anchored to prayers.
  - Multi-step content and university plans.
  - Reminders, rewards, groups, leaderboards, challenges, and sharing.

  Many points conflict with the CRD and phases 06–14. Full analysis: [REQUIREMENTS_V2](./docs/requirements/REQUIREMENTS_V2.md) §3 (C1–C14).
- **Decision:**
  - **Rebuild strategy.** Work on branch `v2`. Keep:
    - the monorepo and Next/Fastify/Drizzle/Supabase
    - Zod in the shared package, Serwist, and the sync pattern
    - the test infrastructure and the pure calculators

    Replace the data model and every screen. No revert and no from-scratch rewrite. See [SYSTEM_DESIGN §1](./docs/architecture/SYSTEM_DESIGN.md#1-rebuild-strategy).
  - **Data model.** Category → Item → Occurrence.
    - Items form a tree. Types: task, habit, goal, plan, group.
    - An Occurrence is a dated instance and its log, with status todo, in_progress, done, skipped, moved, or missed.
    - A pending item has `date = NULL`. Occurrences stay virtual until touched.
    - `habit_definitions` and `habit_logs` are migrated, then dropped in R2.
    - Supersedes the 2026-09-28 "no new tables" decision for prayer/Quran.
  - **Progress rule.** % = done ÷ required. Required excludes optional, skipped, moved, and pending items. If nothing is required, the day is 100%.
  - **Plans replace the fixed content pipeline** (old Phase 09). Steps are child items linked by `item_dependencies`. Cadence rules warn but never block.
  - **Navigation:** Today · Categories · + · Progress · Profile. Calendar becomes the Today date strip.
  - **Phases** are renumbered v2 0–12 under releases R0–R4 ([DEVELOPMENT_PLAN](./docs/plan/DEVELOPMENT_PLAN.md)). Old 06–14 moved to `docs/phases/archive/`.
- **Alternatives considered:**
  - Revert to an earlier commit: rejected, because no earlier UI matches the references.
  - Start from scratch: rejected, because it would re-solve the auth, sync, PWA, and WASM issues already documented here.
  - Extend `habit_logs` with nullable columns: rejected, because it can't cleanly express one-offs, moves, sub-items, or plan steps.
- **Consequences:**
  - The 06A/06B scope continues as v2 Phase 1 and Phase 3.
  - The owner's history must round-trip through the migration with identical report numbers (Phase 1 acceptance).
- **Related:** [PRD](./docs/product/PRD.md), [SYSTEM_DESIGN](./docs/architecture/SYSTEM_DESIGN.md)

### 2026-10-07 — v2 visual direction from owner reference images (supersedes 2026-09-30 redesign)

- **Context:** The owner rejected the Space Grotesk / award-site palette design and wants a simple interface like the 4 images in `UI Images/`.
- **Decision:**
  - **Tokens** are sampled from those images (median of 7×7 patches):

    | Token | Value |
    |-------|-------|
    | Canvas | `#F4F4F9` |
    | Cards | white |
    | Ink / secondary ink | `#1B1A22` / `#64656C` |
    | To Do | `#E66473` |
    | In Progress | `#EBAC80` |
    | Done | `#97BB7D` |
    | Neutral | `#AA8B9A` |
    | Primary | `#7293F1` |
    | Buttons with white text | `#4766D0` (derived) |
    | Categories | ref 4 pastels |

  - **Font:** Poppins.
  - **Dark mode:** derived values, marked `(d)`.
  - **Text on status colors:** always ink.
  - The "colors come from real sources" rule stays. The source is now `UI Images/`.
  - Spec: [DESIGN_SYSTEM_V2](./docs/design/DESIGN_SYSTEM_V2.md).
- **Alternatives considered:** Keep the current palettes with a calmer layout (the owner asked for a new direction). Invent a palette (violates the owner's standing rule).
- **Consequences:**
  - Removed in v2 Phase 2: the `globals.css` themes, `ThemePicker`, Space Grotesk / Space Mono, and the tile Home.
  - The owner approves a UI kit page before any feature screens are built (v2 Phase 0).

### 2026-10-07 — v2 platform choices: Supabase Auth, pg-boss, Web Push now / Capacitor later, adhan-js

- **Context:** v2 needs:
  - accounts (pending since 2026-09-30)
  - scheduled reminders, repeating for critical items
  - prayer times by location
  - reminders that behave like alarms

  Research (2026) found:
  - iOS PWAs receive push only when installed to the Home Screen.
  - EU standalone PWAs lost push in iOS 17.4.
  - A PWA cannot ring an alarm.
- **Decision:**
  - **Supabase Auth.** Fastify verifies JWTs via JWKS.
  - **pg-boss** runs the background jobs: reminders tick, escalation, rewards, streak rollover, and leaderboard snapshots.
  - **Web Push (VAPID)** from v2 Phase 6.
  - A **Capacitor** wrap in v2 Phase 11 for exact alarms and native sharing.
  - **adhan-js** computes prayer times, shared by client and server.
  - Points, badges, streaks, and leaderboards are computed **server-side only**, from an idempotent ledger.
- **Alternatives considered:**
  - Self-hosted Better Auth or Auth0: rejected, since we are already on Supabase.
  - BullMQ + Redis: rejected, extra infrastructure for low volume.
  - React Native now: rejected by the owner (PWA now, native later).
  - Client-computed points: rejected, trivially cheatable.
- **Consequences:**
  - New environment variables: `SUPABASE_JWKS_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
  - iOS users must install the PWA to get reminders until Phase 11.

### 2026-10-07 — Diagrams as rendered images, generated offline

- **Context:** The owner said Mermaid inside markdown doesn't present well and asked for images or a PDF. The npm registry was unreachable from the build environment, so `@mermaid-js/mermaid-cli` couldn't be installed.
- **Decision:**
  - `docs/architecture/diagrams/src/diagrams.py` generates the diagrams, using a small SVG toolkit (`svgkit.py`).
  - Locally installed headless Chrome or Edge rasterises them to PNG.
  - Markdown embeds the PNGs.
  - `docs/build_pack.py` compiles the v2 docs and diagrams into `docs/Life-v2-Design-Pack.pdf` the same way.
- **Alternatives considered:** mermaid-cli (blocked by the network, and its auto-layout is weaker for dense ERDs). Hand-drawn Figma or FigJam (not versioned with the code).
- **Consequences:**
  - To edit a diagram, change the Python, re-run it, and commit the SVG and PNG.
  - Requires Python 3 and Chrome or Edge; no npm packages.

### 2026-10-09 — v2 Phase 0/1 implementation choices

- **Context:** Building the UI kit and the foundation (accounts, v2 schema, sync, offline store) surfaced several choices not covered by the design docs.
- **Decision:**
  - **Env source of truth.** The repo-root `.env.local` is the owner's single source of secrets and wins over `apps/api/.env`. That file held a stale database password and fails auth. The web app fills missing vars from it in `next.config.ts` (via `node:util` `parseEnv`; `@next/env` caches its first directory, so it can't add a second).
  - **RLS on every public table** (migration `0001_v2_core`). Without it, Supabase's auto REST API exposed all app tables to the public anon key (PROJECT.md BUG-003). The API connects as the table owner, so RLS doesn't affect it; it enforces ownership itself.
  - **Token verification.** The API accepts HS256 (legacy JWT secret) and ES256/RS256 via the project JWKS. This project issues ES256, so JWKS is the live path.
  - **Sync cursor.** The pull cursor is a server-side `synced_at` (not the client's `updated_at`), with a 10 s overlap window. Last-write-wins still compares the client `updated_at`. Upserts only touch rows owned by the caller.
  - **Push safety.** Push is planned before writing:
    - Schema-validate every row.
    - Reject rows claiming another user (403).
    - Reject ids owned by another account (409).
    - Reject references to rows the caller doesn't own (422).

    The client retries a refused batch row by row and sets aside only the bad rows (`outbox_rejected`), so one bad row can't block sync.
  - **Old v1 API routes deleted** (`/v1/habits`, old `/v1/sync`, `ensureDefaultUser`, `SYNC_API_KEY`). The `/v1` paths now carry the v2 API, as documented in SYSTEM_DESIGN §6.
    - The v1 screens remain until Phase 2. They work offline only, and their local cache is now per user (`life_sqlite_v1:<userId>`).
  - **v1→v2 migration is owner-run** (`npm run db:migrate:v1 -w @life/api -- --email …`). It defaults to a dry run, and deterministic ids make it idempotent.
  - **Link color token** `--link`: `#4766D0` in light, the sampled `#7293F1` in dark. `#4766D0` text is only ~3:1 on the dark canvas.
- **Alternatives considered:**
  - Server cursor from client timestamps (rejected: device clock skew can hide rows).
  - Keeping the v1 routes behind a flag (rejected: they bypassed ownership, BUG-002).
  - Supabase RLS policies with direct client access (rejected: SYSTEM_DESIGN keeps all writes behind the API for server-computed rewards).
- **Consequences:**
  - The owner should update or delete `apps/api/.env`.
  - Until Phase 2, signed-in users see the v1 screens without sync ("Waiting to sync") and dead theme presets on More.
- **Related:** [phase-00](./docs/phases/v2/phase-00-docs-design.md), [phase-01](./docs/phases/v2/phase-01-foundation.md), PROJECT.md BUG-002/003/004, B-001

### 2026-10-09 — v2 Phase 2 (Today): day-model rules and v1 removal

- **Context:** The Today screen needed exact rules for virtual vs stored occurrences, moves, groups, and offline use. It also replaces every v1 screen.
- **Decision:**
  - **Deterministic occurrence ids.** `occurrenceIdFor(item, date, slot)` is a UUIDv8 over SHA-256. Two offline devices touching the same day merge by last-write-wins instead of hitting the `(item_id, date, slot)` unique index.
  - **Moves.**
    - A one-off moves by changing `item.schedule.date`; its stored occurrence moves with it. `null` = Pending.
    - A repeating item marks the day `moved` and adds an instance on the target day in slot `moved:<from>`.
    - Repeating items can't be Pending; they can be skipped.
  - **Groups** (Daily prayers) render as the kit prayer row. Their children count toward the day %; the group itself doesn't. The tiles count list rows only.
  - **All schedule kinds** (daily, weekdays, every N days, monthly, active range) are evaluated from Phase 2, so migrated items such as Kahf on Fridays show correctly. Anchors only add a caption until Phase 4.
  - **Offline.** App routes are precached per build (`additionalPrecacheEntries`), so every screen opens offline before its first visit.
  - **v1 removed.**
    - Routes deleted: Calendar, Goals, Health, Prayer, More.
    - Code deleted: the v1 components, the sql.js v1 cache, the v1 sync engine, and the shared v1 `habits`/`sync` schemas.
    - Theme is mode-only.
    - Leftover v1 localStorage keys are cleared on sign-in.
    - Shared `prayer.ts` and `health-tracking.ts` are kept for the migration tests and Phases 4 and 7.
- **Alternatives considered:**
  - Random occurrence ids, merging 409s on the server (rejected: needs conflict UI).
  - Moving repeating items by editing their schedule (rejected: it changes every future instance).
  - Keeping the v1 screens alongside (rejected: they no longer sync).
- **Consequences:**
  - The test count dropped from 242 to 147, because the v1 screens' tests went with them. Every v2 path is covered.
  - The owner's history shows on Today once they run `db:migrate:v1 --apply`.
- **Related:** [phase-02](./docs/phases/v2/phase-02-today.md)

### 2026-10-10 — Polish: OTP auth, validation everywhere, top bar, reference themes, cursors

- **Context:** After Phase 2 the owner asked for:
  - a pointer cursor on everything clickable
  - themes
  - a top bar with a user menu
  - clearer, fully validated sign-in and sign-up forms, including confirm password
  - **6-digit email codes instead of links**, with branded emails
  - **every form validated**, with submit disabled until valid
  - number fields that accept numbers only
- **Decision:**
  - **Auth flow:**
    - Sign-up collects full name, email, password (live 5-rule checklist), confirm password, and terms acceptance.
    - Email is confirmed with `verifyOtp({ type: "email" })`; resend has a 60 s cooldown.
    - Password reset is `resetPasswordForEmail` → code + new password → `verifyOtp({ type: "recovery" })` → `updateUser`.
    - The link-based `/auth/update-password` page was removed.
    - The full name travels in `user_metadata.full_name`. The API stores it as `users.display_name` for later leaderboards.
  - **Email templates:** branded HTML templates in `docs/email-templates/`, with the paste steps. Supabase settings: OTP length 6, expiry 15 min, password rules matching the client.
  - **Validation:** shared `lib/forms/validators.ts` + `use-form.ts`.
    - Required `*` markers.
    - Errors appear after blur or a submit attempt.
    - Submit is disabled until valid, with a hint underneath.
    - `sanitizeDigits` keeps numeric inputs digits-only.
  - **Themes:** Sky, Mauve, Sunset, Lavender, one per reference image. Each is AA-checked in light and dark by `tokens.test.ts`. Applied before paint via `data-theme`.
  - **Top bar:**
    - App mark, sync indicator (tap to sync), and an avatar showing your initials.
    - The avatar opens a dialog with name and email, Profile, Pending, Theme, Appearance, Sync now, and Sign out.
  - **Cursors:** a global base-layer rule gives clickables `cursor: pointer` and disabled controls `not-allowed`.
  - The Next dev indicator is turned off; it covered the avatar.
- **Alternatives considered:**
  - Link-based confirmation (owner chose codes).
  - Applying templates via the Management API (owner chose to paste them; no extra token needed).
  - An accent picker instead of themes (owner chose reference themes).
- **Consequences:**
  - The owner must paste the templates and set OTP length and password rules in Supabase.
  - Until then, Supabase's default email contains a confirmation **link**, not the code the app asks for. Clicking that link still confirms the account, after which signing in works.
  - E2E tests never submit the real sign-up form, because bounced test mail can get the project's email sending restricted. The OTP step is covered by component tests.
- **Related:** [docs/email-templates/README.md](./docs/email-templates/README.md), [DESIGN_SYSTEM_V2 §2a–2b](./docs/design/DESIGN_SYSTEM_V2.md)

### 2026-10-10 — Responsive density pass; Upcoming / Overdue on Today; task time

- **Context:** The owner gave this feedback:
  - The UI felt like a big desktop page.
  - Sign-up didn't fit one phone screen.
  - The row popup, account menu and add-task sheet were too large.
  - Tasks "weren't being created".
  - Rows were plain: no icon, colour or progress.

  On the task problem: the server held every task. Tasks added just after midnight with "Tomorrow" went to the next day, and Today only showed the selected day, so they looked lost.
- **Decision:**
  - **Density.**
    - Controls are 36–44 px: buttons md 40 / lg 44, fields 40, rows about 56. Body text is 13–14 px.
    - The popup is 208 px. The account menu is 264 px with 36 px rows.
    - The auth card is compact. Password rules appear only once typing starts.
    - Sign-up and sign-in fit a 390×844 screen without scrolling (verified in E2E).
  - **Responsive.** Phone first.
    - The content column is `max-w-xl`, `md:max-w-2xl` (672 px on tablet).
    - At `lg` (≥1024 px) a 224 px left rail with "Add task" replaces the bottom bar.
    - Sheets are bottom sheets on phones and centred dialogs (max 448 px) from `sm`, with a fade-in instead of a slide.
  - **Where did my task go?**
    - Adding or saving shows a toast with the destination ("Added to Tomorrow, Sun 11 Oct") and a **View** action that jumps to that day.
    - Today now has two new sections:
      - **Overdue:** one-off tasks from earlier days that were never done, skipped or moved. Each shows "Was due …" and a one-tap **Move to today**.
      - **Upcoming:** the next 14 days of one-off tasks, grouped by day. Tapping a day header jumps to it.
  - **Optional time on tasks.**
    - `schedule.time` (HH:mm) is kept only when there is a date.
    - Rows are sorted by time; untimed rows come last.
  - **Row tags.** Each row now carries tags:
    - due date
    - category, with its icon and pastel colour
    - time
    - quantity progress
    - High/Critical priority
    - started time
    - repeat pattern
- **Alternatives considered:**
  - A separate "All tasks" screen: deferred to Phase 3, because Upcoming answers "where is it?" in place.
  - Treating overdue tasks as missed, the way prayers are: rejected. Tasks stay actionable until moved or done.
- **Consequences:**
  - Overdue and Upcoming show only when the selected day is today.
  - The row menu acts on the row's own day (Upcoming and Overdue rows carry their date).
  - Repeating items keep their schedule. Time is for one-off tasks only for now; Phase 3 adds times to routines.

### 2026-10-11 — v2 Phase 3: categories, item editor, routines, history, starter packs

- **Context:** Phase 3 lets users build their own structure. The owner set four choices on 2026-10-10:
  - starter packs live in shared code
  - the pack picker shows only for new accounts with no data
  - reordering uses up/down buttons for now (drag comes later)
  - the whole phase ships with a commit per slice
- **Decision:**
  - **Starter packs.**
    - Seven packs ship in `@life/shared` (`STARTER_PACKS`) with fixed ids and versions, so onboarding works offline.
    - Applying a pack is client-side through the normal action/sync path.
    - The API serves the same list: `GET /v1/templates`, plus `POST /v1/templates/:id/apply` through the push planner. `db:seed:templates` upserts the packs into `templates` for the Phase 12 library.
    - Everything a pack creates carries provenance (`sourceTemplateId`, version, `adoptedAt`). Applying a pack twice adds nothing.
  - **Onboarding.**
    - The app redirects to `/welcome` only after a *successful* first sync, and only when the account has no categories or items and no local `onboarded` flag.
    - An existing account on a new device is never mistaken for a new one, even offline.
  - **Archive.**
    - Archiving a category stamps the same `archivedAt` on its live items. That hides them everywhere through the existing `isDueOn` rule, and unarchive restores exactly that set.
    - Deleting a category moves its items to "No category".
    - History ignores the archive flag for past days and stops counting after the archive date.
  - **Routines** are `group` items whose sub-items copy the parent's schedule and category.
    - Done is derived from the sub-items, never stored.
    - A one-off routine moves together with its sub-items. A repeating routine can be skipped but not moved.
    - Prayer sets are marked with `meta.prayerSet` and keep the chip row.
  - **Tracking.** Checklist ticks live in `occurrence.detail.steps`. Duration minutes live in `occurrence.value` (+5 per tap).
  - **History** (`itemHistory`):
    - one mark per day: done, partial, missed, skipped, today, not due, future
    - skipped days neither break nor extend a streak
    - an unfinished today doesn't break the current streak
    - completion is shown over 90 days
  - **Detail routes** use query parameters (`/categories/view?id=`, `/items/view?id=`, `/items/edit?id=`). Each is one static shell that is precached. The service worker ignores the app's own parameters (not `_rsc`) when matching the precache.
  - **Durability.** Every user action now flushes the local store to IndexedDB immediately. A save followed by a full page load could otherwise be lost on the 250 ms timer; the browser E2E found this.
- **Alternatives considered:**
  - Packs only in the database (onboarding would need a connection).
  - Drag-to-reorder now (deferred by the owner).
  - Dynamic `[id]` routes (they can't be precached per id).
- **Consequences:**
  - Pack edits ship with app releases. Bump `version` when a pack changes.
  - Repeating routines can't be moved to another day yet.
  - Drag reorder, a full history screen (Phase 7) and times on habits (anchors, Phase 4) remain.
- **Related:** [phase-03-categories-items.md](./docs/phases/v2/phase-03-categories-items.md), [DESIGN_SYSTEM_V2 §5](./docs/design/DESIGN_SYSTEM_V2.md)

### 2026-10-11 — Setup asks interests first; nothing added unless ticked; first-run tour

- **Context:** The owner tried the pack picker. Choosing "Spiritual" and "Physical" silently added every suggested item (Quran reading, Steps, Gym…) without asking. The owner asked for interest-based setup and a tour.
- **Decision (owner, 2026-10-11):**
  - **Setup has two steps.**
    1. Pick interests. Each becomes a category.
    2. Tick suggested items per interest. **Nothing is pre-ticked.** Count and minute targets are editable inline. "Finish — I'll add my own" works with nothing ticked.
    - Shared `applySelection` builds exactly that. `applyPacks` (all items) remains for the API.
  - **Spotlight tour** on Today, once after setup. Five tips: ring, tiles, list, +, Categories. Skippable, and replayable from Profile → Help. Desktop uses the side-rail targets. The flag lives in local `meta` and is flushed immediately.
  - **Overdue badge:** an "N overdue" badge by the date jumps to the Overdue list. The ring stays today's plan.
- **Consequences:** Rule-based suggestions; no AI service, and it works offline. Later questions (student or working…) can narrow the suggestions.

### 2026-10-11 — v2 Phase 4: prayer times, just-in-time location, qada, anchors, day parts, insights

- **Context:** Phase 4 (PRY-01…10, SCH-03/04, TOD-06/07). Owner decisions (2026-10-11):
  - Daily prayers is an unticked setup suggestion.
  - Location is asked **just in time**, at the level the feature needs (Never / While using / Always). A covered grant never re-asks; a feature that needs more than was granted re-asks.
  - Today gets a Day view by prayer-based parts.
  - On Fridays, Zuhr reads "Jumu'ah".
- **Decision:**
  - **Prayer times on the device** with adhan-js (`@life/shared`), so there's no API key and they work offline.
    - Karachi method + Hanafi Asr by default; 12 methods.
    - Per-prayer ±30 min nudges and optional fixed times.
    - Karachi coordinates until a location is set, flagged *approximate*.
    - The accuracy test matches AlAdhan within 1 minute (Karachi in October, Lahore in January).
  - **Location layer** (`lib/location`): features call `ensure(level, reason)`.
    - The app's own sheet comes before the browser prompt. It offers Always (disabled on web: needs the phone app), While using, Choose a city, and Never.
    - Never and a picked city are respected. A blocked browser offers a city.
    - Coordinates are rounded to ~1 km.
    - While in use, the fix is refreshed at most every 6 h. A move over 25 km offers "Update prayer times?" and never changes silently.
    - ~70 cities are bundled for offline search and naming.
  - **Missed is derived:** an unmarked prayer on a past day reads as missed. No midnight job; history and insights agree offline. Qada is `done` + `detail.qada`; explicit Missed is stored.
  - **Prayer block:**
    - One tap prayed or clear, in any order.
    - Hold or right-click a chip for On time / Qada / Missed / Clear. The ⋯ sheet sets every prayer of the day; it's the visible alternative to hold.
    - Chips show times, the current prayer is ringed, and the header shows a countdown.
  - **Prayer set editing** in Prayer settings: rename, reorder, remove, and add Tahajjud / Duha / Witr with their place in the day. Ids and keys stay stable, so history follows renames.
  - **Anchors:** repeating items can be at a set time or before / at / after a prayer plus a delay.
    - Windows: after X = X → next prayer; before X = previous → X; at = ±30 min.
    - Windows order rows and ring the row "now"; they never lock ticking.
  - **Day view:** After Fajr, Morning, After Zuhr, After Asr, Evening, Night, plus Anytime, computed from the day's prayer times.
  - **Insights** (`prayerInsights`, on occurrences):
    - week and month totals, rate per prayer, most consistent and most missed
    - on-time streak (qada doesn't extend it) and a suggestion
    - a 30-day missed list with "Mark as qada"
    - The v1 `computeMonthlyPrayerReport` is kept only as a regression test, because its log format no longer exists.
  - **Settings sync:** `user_settings` gains `prayer_manual`, `jumuah_label` and `location_mode` (migration 0002). The local store now adds missing columns on open. Settings writes are queued and applied to the latest row, so quick edits never overwrite each other.
- **Consequences:**
  - Always-on location (and prayer reminders) wait for the native app (Phases 6 and 11). The layer already models that level.
  - Day parts aren't user-editable yet.

### 2026-10-11 — Branching, quality gates, first push; v2 Phase 5: Plans

- **Context:** The owner created `github.com/abdulazizatGitHub/plma-app` and asked for pre-commit and on-push checks (tests, lint, typecheck, error, bug and security checks) and for a branching model. They then asked for Phase 5 (Plans).
- **Decision (branching):**
  - **Environment branches:** `dev` → `preprod` → `main`, with `main` live and `preprod` the test deployment.
  - **Short-lived branches:** `feature/*` and `fix/*` merge into `dev`; `hotfix/*` branches from `main` and is merged back down afterwards.
  - **Versions are semver tags** on `main` (`v0.4.0` = Phases 0–4), not long-lived version branches, so fixes never need copying between them.
  - The old v1 app is kept as the tag `v1-final`.
  - Details are in `docs/guides/BRANCHING_AND_CI.md`.
- **Decision (gates):**
  - **Pre-commit (Husky + lint-staged):**
    - a guard blocks env files, files over 2 MB and `console.log` in app source
    - ESLint `--fix` runs per workspace (web uses its own ESLint 9)
    - secretlint uses the recommended preset plus patterns for JWTs, Supabase / Stripe / AWS keys and DB URLs with passwords
  - **Pre-push:** `npm run verify` (typecheck, lint, tests, `npm audit --omit=dev --audit-level=high`).
  - **CI:** ci (including build and secret scan), CodeQL `security-and-quality`, gitleaks over the full history, dependency review, release on `v*` tags, and Dependabot into `dev`.
  - **Security fixes on the way:**
    - Next 16.3.6 → 16.3.8 (cache poisoning, SSRF and other advisories)
    - `npm audit fix` for sharp and source-map-js
    - production dependencies now have 0 vulnerabilities
  - The full history was scanned before the first push; it contains only placeholders and the local docker dev password.
- **Decision (Phase 5):**
  - **A plan** is an item of type `plan` that never appears on Today itself. Its steps are dated one-off tasks with `meta.stepKind`, and they appear on Today on their dates with the plan as context. Undated steps sit in Pending until done.
  - **"Waits for"** links are `item_dependencies` rows, and loops are refused. A locked step shows a lock and the reason instead of its tick.
  - **Cadence rules** are `cadence_rules` rows per step kind, scoped to the plan or to the whole category:
    - `weekdays` = allowed days
    - `gapDays` = minimum days between steps **of the same kind** (across the category's plans for category rules)
    - The checker warns and suggests the next three valid dates; the picked date is always saved.
  - **Presets are data:**
    - content collab: Shoot, Edit, Payment cleared, Post; Post waits for Payment
    - university course: quick-add Assignment, Quiz, Presentation, Teacher meeting, FYP
    - blank
  - **Where plans live:** `/plans` and `/plans/view?id=` (precached), a Plans section in categories ("Nothing upcoming" for content and university categories without active plans), Categories → Plans, and quick add → New plan.
  - **Edit queues:** rule edits are queued against the stored rows, like settings edits, so quick taps never duplicate rules.
- **Consequences:**
  - Per-step reminders (PLN-03, second half) arrive with Phase 6.
  - Branch protection and Actions settings are the owner's to switch on in GitHub.
  - The first push's CI didn't start: GitHub listed the workflows as active, but no runs appeared. Check Settings → Actions → General.

### 2026-10-11 — Rows settle in place before changing section

- **Context:** The owner reported that tapping + (or ticking) made the row vanish from To Do and reappear further down in In Progress or Done, mid-edit.
- **Decision:**
  - A row stays in the section it was in while it's being worked on. Every progress tap (+/−, tick, checklist step, minutes) restarts a short pause of 2.5 s (`SETTLE_MS`).
  - While it waits, a "→ In Progress" / "→ Done" tag says where it's going.
  - It then moves, animated with the View Transitions API where supported. Reduced-motion settings get an instant move.
  - The status tiles and the % update at once; only the row's position waits.
  - Menu actions (Skip, Move) still apply at once, because the user asked for them explicitly.
- **Where:** `lib/v2/use-settle.ts` (`useSettledPlacement`); Today places rows by their held state.

### 2026-10-12 — Daily items belong to their day; reached goals fold away

- **Context:** The owner noticed two problems:
  - Past days' habits (steps, reading, gym, prayers) could be ticked days later, which makes history and streaks meaningless.
  - Steppers stayed big after a goal was reached, inviting endless taps.
- **Decision (day modes, `dayAccess`):**
  - **Today: live.**
  - **Yesterday: late logging** (`LOG_GRACE_DAYS = 1`).
    - You can log what you did but forgot to record. A banner says it closes at midnight.
    - Tapping a prayer records **qada**; "on time" stays available in the menu, in case you prayed but forgot to tap.
  - **Older days: history.**
    - Read-only: checks are disabled, there are no steppers, and unfinished items are tagged "Missed" under a "Not done" heading.
    - Unfinished one-off tasks can still be **moved to today**, and missed prayers **recovered as qada** (the owner's earlier qada rule).
  - **Future days: planned.** Add, skip, move or edit, but no ticking or logging until the day comes.
  - **Before creation:** repeating items don't appear on days before they were created (unless a record exists then, e.g. v1 history), so they can't be "missed" there.
- **Decision (goals):**
  - Extra effort is real data and is kept: "Goal reached · 11,500 steps" plus "+1,500 over".
  - The stepper folds once the goal is reached; "Log more" brings it back.
  - It never folds mid-tap: a row still being edited keeps its stepper until it settles.


### 2026-10-12 — Days lock at the user's day-end; Today summary card

- **Context:** After midnight the owner could still edit the previous day. Its progress never became final, so streaks and future rewards had nothing solid to stand on. The 48 px ring was also too small to say much about the day.
- **Decision (day lock):**
  - Grace is removed (`LOG_GRACE_DAYS = 0`). A day becomes **history** (read-only) as soon as it ends.
  - "When it ends" is the user's choice: **Profile → Your day → My day ends at**, from midnight up to 4 AM (`user_settings.day_end_hour`, migration `0003`).
  - Before that hour it is still the previous day. `logicalToday` and `TodayProvider` switch at that boundary, on focus, and when the app returns to the foreground.
  - Locked days still allow two kinds of recovery: moving unfinished one-off tasks to today, and recording missed prayers as qada.
- **Decision (summary card):** the header ring is replaced by one card at the top of Today:
  - a 112 px segmented ring (done, in progress, to do; missed on a closed day) with the % and "done" or "final"
  - an "X of Y done" legend
  - a one-line summary: what's left and what's next, or "Day closed"
  - a per-prayer bar
  - the perfect-day streak: current and best
- **Streak rule (`dayStreak`):** consecutive days at 100%. Days with nothing due are neutral. An unfinished today doesn't break the run until it locks. Badges and rewards (Phase 8) build on these locked days.

### 2026-10-12 — Phase 6 reminders: priority windows, one reminder per item, queue table instead of pg-boss

- **Context:** The owner chose reminders that follow priority, with each priority's window editable in Settings. Any item can have its own reminder; when it does, the auto reminder is off, so only one is active at a time. Repeat and snooze are the user's to set, per priority or per item.
- **Decision (model):**
  - **Auto reminders are virtual:** they are derived from `user_settings.reminder_profiles`, so editing a priority applies to every item at once.
  - **A custom reminder is a `reminders` row.**
    - "Off" is a row with `enabled=false`; "Back to auto" deletes it.
    - Two offline devices could each make one, so the latest live row wins; there is no unique index, which would break sync.
  - Defaults per REM-02 (both editable):

    | Priority | Default |
    |---|---|
    | low | off |
    | medium | once |
    | high | once, plus one follow-up after 30 min |
    | critical | every 30 min, up to 6 more, until done |

    Snooze is 10 min for all of them.
  - **Untimed items** remind at a check-in time (default 8 PM).
  - **Quiet hours** delay fires to their end; a run of repeats continues from there.
- **Decision (server):**
  - **No pg-boss.** The `reminder_queue` table is the queue. The tick runs every minute with `FOR UPDATE SKIP LOCKED`, which is safe with several instances, and avoids a second Postgres driver and the pooler's limits.
  - **Planning:**
    - The planner rewrites a user's future fires 3 s after any sync push, plus an hourly sweep.
    - Fires that are due but not yet sent are kept. A race in E2E showed that a replan could otherwise drop them.
  - **The notification's Done and Snooze** carry a 24-hour HMAC-signed token for exactly one fire.
    - Done writes the occurrence as a tap would (shared `toggleDone`), never on a locked day.
    - Snooze waits the item's snooze length.
- **Limits:**
  - Push needs HTTPS: Android and iPhone are checked after the preprod deploy.
  - iPhone needs the app installed to the Home Screen, which the settings page explains.
  - Delivery can be a minute late. Exact alarms come with the native wrap (Phase 11).

### 2026-10-12 — Prayer timing: now / next / not marked yet; Isha after midnight; never assume qada

- **Context:**
  - In the evening, the Today card said "next: Fajr · 4:48 AM". After Isha, the code took *tomorrow's* Fajr and matched it to *today's* unmarked Fajr.
  - Prayers whose time had passed looked just like open ones.
  - Isha, which is valid until Fajr, locked at midnight.
- **Decision** (shared `prayer/timing.ts`):
  - **A prayer's time runs until the next prayer.**
    - At 9 PM it reads "Isha now · until 5:13 AM tomorrow"; after Isha is marked, "next: Fajr tomorrow · 5:13 AM".
    - The prayer whose time it is leads the card's next-up line.
  - **Never assume qada (owner):** people pray on time and mark later, or mark everything at night.
    - A prayer whose time passed reads "time passed, not marked": a dashed, neutral chip, not qada and not missed.
    - Tapping it records **prayed on time**. A toast offers "Prayed late?" to switch it to qada.
    - "Mark today's prayers" has **All on time**.
    - An unmarked prayer becomes missed only when its day closes.
  - **Isha after midnight:** while yesterday's Isha is unmarked and before Fajr, Today shows "Isha (Mon) · still on time until …" with **Prayed** (on time), even though yesterday has locked. After Fajr it is a normal closed-day prayer.
  - **Hanafi preferred times are notes only:**
    - Isha: "best before" Islamic midnight (midpoint of Maghrib and Fajr)
    - Asr: before the sun yellows (about 20 min before Maghrib)
    - Shown in the headline and the check-in; never a status.

### 2026-10-12 — "Remind me…" from a row's menu (today only, or every day)

- **Context:** The owner wanted to set a reminder straight from a task's ⋯ menu, with a popup. They chose **today only** by default, using the existing Phase 6 reminder (priority / custom / off, repeat, snooze) rather than a new set of quick picks.
- **Decision:**
  - **Menu item:** "Remind me…" opens a sheet with **Today only / Every day**, plus the same Reminder section as the item editor.
  - **Today only:**
    - Stored on that day's occurrence (`detail.reminder`), so it syncs with the day.
    - It replaces the item's usual reminder for that day only. "Usual" puts it back; "Off" silences just that day.
    - One reminder is still active per item per day. The global switch and category mute still apply.
  - **Every day:** saves the item's own custom reminder, exactly as in the editor.
  - **Defaults and checks:**
    - A new reminder for today defaults to about 30 minutes from now.
    - A time that has already passed today can't be saved.
    - The row shows "6:15 PM (this day)".
  - **Hidden** on locked days, for prayers (they remind at their own times), and for done items.
