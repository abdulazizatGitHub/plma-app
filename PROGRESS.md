# Progress tracker

Last updated: **2026-09-28**

## Overall

| Milestone | Status |
|-----------|--------|
| Phase 01 | Done |
| Phase 02 | Done — Supabase session pooler + migrations |
| Phase 03 | Done — home wired to synced habits |
| Phase 04 | Done (pending manual browser check) — prayer & Quran logging + monthly report |

---

## Phases

| Phase | Doc | Status | Acceptance |
|-------|-----|--------|------------|
| 01 | [foundation](./docs/phases/phase-01-foundation.md) | Done | Yes |
| 02 | [data-sync](./docs/phases/phase-02-data-sync.md) | Done | Yes |
| 03 | [shell-home](./docs/phases/phase-03-shell-home.md) | Done | Yes |
| 04 | [prayer-quran](./docs/phases/phase-04-prayer-quran.md) | Done | Yes (see verification note) |
| 05+ | … | Not started | — |

---

## Current sprint

- **Active:** Phase 05 — health (steps, water, exercise, sleep)
- **Next:** Phase 06 — reading, university, custom habits

---

## Testing & tooling

- Vitest across `packages/shared`, `apps/api`, `apps/web` (106 tests) — `npm run test`
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
