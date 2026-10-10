# Progress tracker

Last updated: **2026-10-10**

## Overall

| Milestone | Status |
|-----------|--------|
| Phase 01 | Done |
| Phase 02 | Done — Supabase session pooler + migrations |
| Phase 03 | Done — home wired to synced habits |
| Phase 04 | Done — prayer & Quran logging + monthly report (browser-verified 2026-09-30) |
| Phase 05 | Done — steps, water, exercise, sleep + `/health` |
| **v2 Phase 0** | Docs approved 2026-10-08. UI kit built at `/dev/ui-kit`, **awaiting owner review**. |
| **v2 Phase 1** | **Built and verified.** Accounts, v2 schema plus RLS, sync, IndexedDB store. Last step: the owner signs up and runs the v1 data migration. |
| **v2 Phase 2** | **Built and verified.** Today, Pending, Categories (read-only), Progress (7 days), Profile; v1 removed; offline launch verified. |
| **Responsive pass (2026-10-10)** | Done. Compact density, phone-first layout with a tablet column and a desktop side rail, Upcoming and Overdue on Today, optional task time, add toast with View, tagged rows. |
| **Polish (2026-10-10)** | Done. OTP auth with full validation, branded email templates (owner pastes), top bar and user menu, 4 reference themes, pointer cursors, digits-only numeric inputs. |

---

## Phases

| Phase | Doc | Status | Acceptance |
|-------|-----|--------|------------|
| 01 | [foundation](./docs/phases/phase-01-foundation.md) | Done | Yes |
| 02 | [data-sync](./docs/phases/phase-02-data-sync.md) | Done | Yes |
| 03 | [shell-home](./docs/phases/phase-03-shell-home.md) | Done | Yes |
| 04 | [prayer-quran](./docs/phases/phase-04-prayer-quran.md) | Done | Yes |
| 05 | [health](./docs/phases/phase-05-health.md) | Done | Yes |
| 06–14 (v1 plan) | [archive](./docs/phases/archive/) | Superseded by v2 | — |
| v2 0–12 | [v2 phases](./docs/phases/v2/README.md) | 0–2 done · 3 next | see phase docs |

---

## Current sprint

- **Owner to-do:**
  1. Paste the email templates and set OTP length, expiry and password rules ([docs/email-templates/README.md](./docs/email-templates/README.md)).
  2. Sign up, then enter the 6-digit code from the email.
  3. Run `npm run db:migrate:v1 -w @life/api -- --email <you>` (dry run), then again with `--apply`.
  4. Update or delete the stale `apps/api/.env`.
- **Next:** v2 Phase 3 (Categories and items): category CRUD, full item editor (tracking, schedules, priority), routines, item detail, starter packs.

---

## Testing & tooling

- Vitest across `packages/shared`, `apps/api`, `apps/web` (178 tests) — `npm run test`
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
