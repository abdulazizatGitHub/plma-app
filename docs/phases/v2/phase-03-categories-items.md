# v2 Phase 3 — Categories and items

**Release:** R1 · **Requirements:** CAT-01…03, CAT-05, ITM-01…03, ITM-05…07, TRK-02…04, SCH-02, HIS-01 (basic) · **Depends on:** 2

## Goal

Users build their own sections and decide, for each item, what it tracks, how important it is, and when it happens.

## Scope

- **Categories page:**
  - category cards showing today's ring and counts
  - expand a category inline
  - reorder by drag or with move buttons
  - create, rename, set icon and color, archive, delete
- **Category detail:** items grouped by type; reorder; pin to top.
- **Full item editor** ("More options" from +):
  - type
  - tracking: check; quantity (unit, target, step); duration; checklist
  - priority, plus an optional flag
  - schedule: once, daily, weekdays, every N days, or monthly, with active from/until dates
  - notes and extra fields
- **Sub-items:** routines, e.g. "Gym — Push day" with its exercises as children or as a checklist.
- **Item detail:**
  - today's control
  - schedule summary
  - basic history: month heatmap, 7-day bars, completion rate, current streak
- **Templates and starter packs:**
  - `GET /v1/templates` and `apply`
  - onboarding picker: Spiritual, Physical, Health, Mental, Content creation, University, Work, or "Start empty"
  - provenance recorded on applied items

## Acceptance

- [ ] Create "Physical" with Steps (quantity, target 10,000, step 500). Log +500 twice, then type 10000. Works from both Today and the detail page.
- [ ] Create "Gym — Push day" with 5 exercises. Ticking all children completes the parent.
- [ ] A habit scheduled for weekdays [Mon, Wed, Fri] appears only on those days.
- [ ] Archiving a category hides it everywhere and keeps its history.
- [ ] A new user picks two starter packs, and only those appear.
