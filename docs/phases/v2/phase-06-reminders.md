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

- [ ] A medium reminder fires once at the set time, on Android Chrome and on an installed iPhone PWA.
- [ ] A critical reminder repeats every 30 min. It stops as soon as the item is done, including when Done is tapped on the notification.
- [ ] Nothing fires during quiet hours. Muting a category silences its items.
- [ ] A prayer-relative reminder (10 min after Asr) fires at the right local time across a DST change (unit test).
