# v2 Phase 2 — Today

**Release:** R1 · **Requirements:** TOD-01…05, CAT-04, ITM-04, TRK-01, TRK-05, SCH-01, SCH-05, SCH-06, FLX-01…05, UI-02, UI-04 · **Depends on:** 1

## Goal

Home opens on today's **To Do / In Progress / Done**. Days are flexible and can be planned ahead.

## Scope

- **New app shell.** Bottom nav: Today · Categories · + · Progress · Profile. Delete the old dashboard, prayer, health, and goals screens and the old themes.
- **Shared logic** in `packages/shared`, with tests:
  - `ScheduleExpander`, covering once and daily schedules only in this phase
  - `ProgressRule`
- **Today screen:**
  - header ring
  - DateStrip covering past and future days
  - StatusTiles that filter the list
  - three status lists, plus a collapsed "Not today" section
- **Interactions:**
  - one-tap check
  - quantity stepper
  - Start, which moves a task to In Progress
  - long-press or ⋯ menu: Skip, Move to tomorrow, Move to date, Pending, Edit
- **Quick add (+):**
  - title
  - date chip: Today, Tomorrow, or a picked date; no date means Pending
  - optional category and priority
- **Pending list,** reachable from Today.
- **Dark mode** using the derived tokens.

## Acceptance

- [x] Today puts items in the correct buckets. A quantity at 4,000 of 10,000 shows as In Progress. Covered by shared `today.test.ts` and web `today-screen.test.tsx`.
- [x] Skip, Move, and Pending each remove the item from today's required count, and the ring can still reach 100%. Unit-tested, and verified in a live browser E2E.
- [x] A day with nothing required shows 100% and "Nothing planned for today" with an Add button. Live E2E.
- [x] A task added for tomorrow appears on tomorrow's list immediately, including when offline.
  - Live E2E: added under CDP offline emulation, confirmed absent from the server, then synced with tomorrow's date once back online.
- [x] Browser check passes at 430 px in light and dark. Tests cover the edge cases of the progress rule.
  - E2E: 10/10 checks against real Supabase and API.
  - Screenshots reviewed.
- [x] Carried over from Phase 1: the app opens offline.
  - Production build with the service worker: offline reload stays signed in, today's data comes from IndexedDB, and the Progress tab opens from the cache.
  - App routes are precached per build (`next.config.ts`).
