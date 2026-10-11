# Progress tracker

Last updated: **2026-10-11**

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
| **v2 Phase 3** | **Built and verified.** Category create/edit/reorder/archive/delete, category detail, full item editor (task/habit/routine; tick, count, time, checklist; daily, some days, every N days, monthly, active range), routines, item page with streaks, 7-day bars and heatmap, starter packs and onboarding. Browser acceptance 16/16; offline 6/6. |
| **v2 Phase 5** | **Built and verified.** Plans: presets (content collab, university course, blank), dated steps on Today, "waits for" locks, cadence warnings and suggestions, rules per plan or category, /plans and the plan page, category Plans section. Browser 10/10. |
| **Repo & gates (2026-10-11)** | Pushed to GitHub (`main` / `preprod` / `dev`, tags `v0.4.0`, `v1-final`). Pre-commit and pre-push hooks, CI, CodeQL, gitleaks, dependency review, Dependabot. Next 16.3.8 security update. |
| **v2 Phase 4** | **Built and verified.** Prayer times (adhan-js, Karachi + Hanafi, nudges and fixed times), just-in-time location, prayer block with times, now, Jumu'ah, qada / missed, prayer editing, prayer anchors and the now highlight, Day view, insights and qada recovery, Progress card. Browser 16/16. |
| **Setup & tour (2026-10-11)** | Done. Interests first, then tick suggestions (none pre-ticked, editable targets); spotlight tour (replay in Profile); overdue badge by the date. Browser 9/9. |
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
| v2 0–12 | [v2 phases](./docs/phases/v2/README.md) | 0–5 done · 6 next | see phase docs |

---

## Current sprint

- **Owner to-do:**
  1. Paste the email templates and set OTP length, expiry and password rules ([docs/email-templates/README.md](./docs/email-templates/README.md)).
  2. Sign up, then enter the 6-digit code from the email.
  3. Run `npm run db:migrate:v1 -w @life/api -- --email <you>` (dry run), then again with `--apply`.
  4. Update or delete the stale `apps/api/.env`.
- **Next:** v2 Phase 6 (Reminders and alarms, including per-step plan reminders).

---

## Testing & tooling

- Vitest across `packages/shared`, `apps/api`, `apps/web` (279 tests) — `npm run test`
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
