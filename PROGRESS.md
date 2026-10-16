# Progress tracker

Last updated: **2026-10-16**

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
| **v2 Phase 7** | **Built and verified.** History and analytics: Progress week/month (average of finished days, trend, perfect days, streaks, insights, categories), item log, category last-7-days card. History can't be rewritten: target snapshots, day closing (missed rows), a server guard on past days, and a 2-day correction window marked late. Tests: 371; API integration 11/11; browser checks. |
| **v2 Phase 9a** | **Built and verified.** Profile (@username, avatar colour), visibility (Everyone / Friends / Selected / Only me), friends by invite link or @username, block, Friends and Everyone leaderboards with podium awards, shares (day, streak, award, item streak) with kudos, Activity with a bell, social pushes. Tests 421; API privacy and flow suite 29/29; podium check; browser 11/11 with two accounts. **9b (groups and group goals) next.** |
| **v2 Phase 8.1** | **Built and verified.** Three daily rings (Prayer, Commitments, Balance) lead Today and Progress; monthly challenge; awards catalogue with milestones, perfect month, Jumu'ah and Hijri seasonal awards (Hijri adjustment in Prayer settings); All awards page. Tests 410; API integration 12/12 (+ Phase 8's 11/11); browser 7/7. |
| **v2 Phase 8** | **Built and verified.** Motivation: points by priority (qada half, late fixes 0), perfect-day bonus, levels, streak with freezes, 7 badges, Rewards card on Progress, a line on Today, celebrations (reduced motion: toasts). Phase 7 hardened first (entry identity, window-aware late, qada asked on yesterday). Tests 397; API integration 11/11; browser 8/8. |
| **v2 Phase 6** | **Built; desktop-verified.** Reminders by priority (window, repeat and snooze editable in Settings), a custom reminder per item that replaces the auto one, Web Push with Done / Snooze on the notification, quiet hours, global switch, category mute, morning summary and plan-tomorrow nudges, iOS install guide. Desktop Chrome E2E 13/13. **Android and iPhone checks wait for a preprod deploy (HTTPS).** |
| **Day lock & summary (2026-10-12)** | Done. Days lock at the user's day-end hour (midnight–4 AM); Today summary card with segmented ring, prayers bar and perfect-day streak. |
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
| v2 0–12 | [v2 phases](./docs/phases/v2/README.md) | 0–8 and 9a done (6 awaits phone checks) · 9b next | see phase docs |

---

## Current sprint

- **Owner to-do:**
  1. Paste the email templates and set OTP length, expiry and password rules ([docs/email-templates/README.md](./docs/email-templates/README.md)).
  2. Sign up, then enter the 6-digit code from the email.
  3. Run `npm run db:migrate:v1 -w @life/api -- --email <you>` (dry run), then again with `--apply`.
  4. Update or delete the stale `apps/api/.env`.
- **Owner to-do (Phase 6):** set `VAPID_SUBJECT` in `.env.local` to a contact address of your choice (it is sent to browser push services); add the four push keys to the hosting env when preprod is deployed.
- **Next:** deploy preprod (HTTPS) to check reminders on Android and an installed iPhone; then v2 Phase 9 (Social).

---

## Testing & tooling

- Vitest across `packages/shared`, `apps/api`, `apps/web` (278 tests) — `npm run test`
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
