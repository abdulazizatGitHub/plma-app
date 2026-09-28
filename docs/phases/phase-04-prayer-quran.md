# Phase 04 — Prayer & Quran Tracking

## Goal

CRD §2–3: five daily prayers (completed/missed), statistics (daily/weekly/monthly/%); Surah Mulk nightly; Surah Kahf Fridays only.

## Requirements

- FR-04-01: Mark each prayer Completed or Missed; auto-maintain history.
- FR-04-02: Stats: counts, completion %, month-end summary.
- FR-04-03: Mulk nightly checkbox; weekly/monthly consistency.
- FR-04-04: Kahf on Fridays only; N/A other days in calendar/home.

## Acceptance criteria

- [x] All five prayers loggable per day — `/prayer` page, tap-to-cycle pending → completed → missed per prayer, written via `saveHabitLogLocally`
- [x] Monthly prayer report view — `computeMonthlyPrayerReport` (shared, unit-tested incl. leap years/month boundaries) rendered as a day-by-day grid with overall %
- [x] Kahf hidden/disabled non-Friday — button `disabled` + "N/A today" outside Fridays, using shared `isFriday`

**2026-09-28 verification:** Full automated coverage — `packages/shared` (schemas + pure logic: prayer, quran, date, slug), `apps/web` (`today-summary`, `sync-engine` incl. offline/push/pull failure paths, and a rendered `PrayerTracker` component test asserting the exact payload written on a prayer-button click), `apps/api` (`requireApiKey`). 106 tests total, all passing; `npm run lint` and `npm run typecheck` clean across all three workspaces. API dev server (`tsx watch`) restarted cleanly through every source edit made in this phase, confirming no runtime import/syntax errors. UI itself not re-verified in a live browser here (see Phase 03's note on this sandbox's headless-browser limitations) — recommend a manual check of `/prayer` before fully closing.
