# v2 Phase 4 — Spiritual: prayers and anchors

**Release:** R1 · **Requirements:** PRY-01…07, SCH-03, SCH-04, TOD-06, TOD-07 · **Depends on:** 3

## Goal

A customisable prayer block, one-tap marking in any order, prayer-time anchors, and honest insights.

## Scope

- **Settings:**
  - location, from device geolocation or a city search
  - calculation method and madhab
  - manual override per prayer
- **`PrayerTimes`** (adhan-js) in `packages/shared`. The client uses it now; the server reuses it later.
- **"Daily prayers" group item:**
  - five default children
  - rename, add, remove, and reorder prayers
  - placement on Today and in any category
- **PrayerRow and ring:**
  - one tap marks a prayer as prayed
  - long-press offers Missed, Qada, and Undo
  - no order is enforced
- **Anchors in the item editor:** before, at, or after a prayer, with an offset. Can be combined with weekdays, e.g. Kahf on Friday after Zuhr.
- **Day parts:** user-defined, optionally prayer-based. Today gets a toggle to group by day part.
- **Prayer insights:**
  - totals per week and month
  - rate per prayer
  - most missed and most consistent prayer
  - suggestion text
  - reuses `computeMonthlyPrayerReport`

## Acceptance

- [ ] Mark Asr while Fajr is unmarked, then mark Fajr as qada. Both count.
- [ ] "Surah Kahf · Friday · after Zuhr" appears only on Fridays, highlighted between Zuhr and Asr. It does not appear on other days.
- [ ] Renaming Zuhr → Dhuhr and adding Tahajjud updates the ring, insights, and history.
- [ ] Insights for a fixture month match hand-calculated totals, including the most-missed prayer.
- [ ] Karachi prayer times on a fixture date match a reference source within 1 minute.
