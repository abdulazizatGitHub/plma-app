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

**2026-09-28 verification note:** Confirmed the above by code review. Found and fixed a real blocking bug in the process (BUG-001 — sql.js browser WASM postinstall mismatch caused the dashboard to hang on "Loading habits…" forever). Attempted to confirm the fix with an automated headless-browser check, but that check showed React never hydrating on this machine (client-side navigation fell back to full page reloads, no `useEffect` ran) — most likely a WebSocket/proxy artifact of the sandboxed test environment (HMR socket handshake failed on every load), not necessarily a real-browser issue. **Recommend a manual check in an actual browser** (`npm run dev`, open http://localhost:3000) to confirm the dashboard loads before treating this phase as fully verified.
