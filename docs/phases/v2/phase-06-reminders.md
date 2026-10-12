# v2 Phase 6 — Reminders

**Release:** R2 · **Requirements:** REM-01…06 · **Depends on:** 3 (and 4 for prayer-relative triggers)

## Goal

Reminders that match importance: critical items keep nudging until done.

## Scope

- **Push setup:**
  - VAPID keys
  - `push_subscriptions` endpoints
  - Service worker handles `push` and `notificationclick`, with **Done** and **Snooze** actions
- **Scheduling:** pg-boss, in the API process or a separate worker. Jobs: `reminders.tick` (every minute) and `reminders.escalate`.
- **Reminder editor on items:**
  - at a set time
  - N minutes before due
  - relative to a prayer
- **Priority defaults:** per REM-02, editable.
- **Settings:**
  - quiet hours
  - a global switch
  - per-category mute
- **iOS:** a guide to install to the Home Screen, shown when the user turns on notifications in Safari.
- **Optional nudges:** an evening "Plan tomorrow" nudge and a morning summary.

## Acceptance

- [~] A medium reminder fires once at the set time — **verified on desktop Chrome**; Android Chrome and an installed iPhone PWA wait for the preprod deploy (push needs HTTPS).
- [x] A critical reminder repeats every 30 min (user-editable). It stops as soon as the item is done, including when Done is tapped on the notification (unit + E2E).
- [x] Nothing fires during quiet hours (it waits for their end; repeats resume after). Muting a category silences its items (unit + E2E).
- [x] A prayer-relative reminder (10 min after Asr) fires at the right local time across a DST change (unit test, Europe/London 25 Oct 2026).
