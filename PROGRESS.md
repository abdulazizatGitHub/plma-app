# Progress tracker

Last updated: **2026-09-30**

## Overall

| Milestone | Status |
|-----------|--------|
| Phase 01 | Done |
| Phase 02 | Done — Supabase session pooler + migrations |
| Phase 03 | Done — home wired to synced habits |
| Phase 04 | Done — prayer & Quran logging + monthly report (browser-verified 2026-09-30) |
| Phase 05 | Done — steps, water, exercise, sleep + `/health` |

---

## Phases

| Phase | Doc | Status | Acceptance |
|-------|-----|--------|------------|
| 01 | [foundation](./docs/phases/phase-01-foundation.md) | Done | Yes |
| 02 | [data-sync](./docs/phases/phase-02-data-sync.md) | Done | Yes |
| 03 | [shell-home](./docs/phases/phase-03-shell-home.md) | Done | Yes |
| 04 | [prayer-quran](./docs/phases/phase-04-prayer-quran.md) | Done | Yes |
| 05 | [health](./docs/phases/phase-05-health.md) | Done | Yes |
| 06+ | … | Not started | — |

---

## Current sprint

- **Active:** Phase 06A — accounts & data isolation (multi-user; see CLIENT_REQUIREMENTS Addendum A)
- **Next:** Phase 06B — customization: templates, own habits, goals & targets (absorbs original Phase 06)
- **Later:** Phase 14 — public template library (rules recorded as LIB-01…05)

---

## Testing & tooling

- Vitest across `packages/shared`, `apps/api`, `apps/web` (185 tests) — `npm run test`
- ESLint (typescript-eslint, `no-explicit-any` as error) — `npm run lint`
- `tsc --noEmit` per workspace — `npm run typecheck`

## Feature log

| Feature | Phase | Status |
|---------|-------|--------|
| Supabase Postgres | 02 | Done |
| System habit seed (9 templates) | 02 | Done |
| Offline SQLite + pull/push | 02 | Done |
| Home daily summary + completion % | 03 | Done (logging UI in 04+) |
| Goals → Content entry | 03 | Done (shell) |
| Prayer logging (5x daily, tap-to-cycle) | 04 | Done |
| Quran Mulk (nightly) / Kahf (Friday-only) | 04 | Done |
| Monthly prayer report | 04 | Done |
| Research-derived redesign (palettes, Space Grotesk, tile Home, explicit prayer actions) | 03/04 | Done |
| Steps: manual entry, quick add, editable goal, week/month stats | 05 | Done |
| Water: glass-by-glass (6/8), editable goal, week/month stats | 05 | Done |
| Exercise: type + duration, consistency stats | 05 | Done |
| Sleep: bed/wake → duration, 06:00 wake goal, averages + consistency | 05 | Done |
