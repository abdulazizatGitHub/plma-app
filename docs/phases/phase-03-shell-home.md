# Phase 03 — Navigation Shell & Home Dashboard

## Goal

Bottom navigation (Home, Goals, Calendar, Progress, More) and Home screen showing **today’s progress** overview per CRD §18, wired to real data from Phase 02+ as features land.

## Scope

- 5-tab layout, active states, safe-area for mobile PWA
- Home sections: prayer, quran, steps, water, exercise, reading, study, make bed, no phone — with completed/incomplete visual states
- Empty/loading states; pull-to-refresh triggers sync

## Requirements

- FR-03-01: Each nav tab routes to a page shell.
- FR-03-02: Home displays aggregated daily completion % when data exists.
- FR-03-03: Content creation entry linked from Goals or More (per UI decision).

## Acceptance criteria

- [x] All five tabs navigable — `bottom-nav.tsx` routes to `/`, `/goals`, `/calendar`, `/progress`, `/more`; all five page shells exist
- [x] Home matches CRD §18 field list (stub zeros until feature phases) — `today-summary.ts` rows: prayer, quran, steps, water, exercise, reading, study, make bed, no phone (reading/study intentionally stubbed pending Phase 06)
- [x] Daily completion percentage computed from configured habits for the day — `buildTodayDashboard()` computes `completionPercent` from tracked habit definitions/logs for today's date, excluding not-yet-implemented rows

**2026-09-28 verification note:** Confirmed the above by code review, then found and fixed a real blocking bug in the process (BUG-001 — sql.js browser WASM postinstall mismatch caused the dashboard to hang on "Loading habits…" forever). An automated headless-browser check was inconclusive (hydration didn't run in that sandbox — a WebSocket/proxy artifact, not an app bug), but the owner confirmed in a real browser afterward: nav renders, "Today's progress" shows live completion %, and all nine CRD §18 rows populate correctly. **Phase verified.**
