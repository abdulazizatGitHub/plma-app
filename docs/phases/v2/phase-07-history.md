# v2 Phase 7 — History and analytics

**Release:** R2 · **Requirements:** HIS-01…04, FLX-06 · **Depends on:** 3

## Goal

Clear week and month views of how things are going, per item, per category, and overall.

## Scope

- **Progress page:**
  - overview of the day % over the week and the month
  - per category: completion, skipped, and moved counts
  - "doing well / needs attention"
- **Item history, completed:**
  - log list with values
  - best streak
  - skip and move counts
- **Day rollover:** unresolved required occurrences count as **missed** in stats and streaks. They never carry over to the next day.
- **Backfill:** past days can be edited from the date strip or the item history. Late edits earn no points after 48 h; Phase 8 enforces this.
- **Stats code:** the old health and sleep stats (`summarizeCounter`, `summarizeSleep`, …) now read from occurrences.

## Acceptance

- [x] Week and month summaries match a seeded fixture (`history-phase7.test.ts`, hand-computed values).
- [x] A required item left open yesterday shows as missed in history and is not in today's list. Once its 2-day window ends, the server writes it down as missed (day closing).
- [x] Editing last Tuesday's steps updates that week's chart. Inside the 2-day window it is accepted and marked late; after that the server refuses it and the app puts the old value back (owner decision 2026-10-13).
