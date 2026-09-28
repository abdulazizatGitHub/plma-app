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

- [ ] All five tabs navigable
- [ ] Home matches CRD §18 field list (stub zeros until feature phases)
- [ ] Daily completion percentage computed from configured habits for the day
