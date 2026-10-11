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

- [x] Mark Asr while Fajr is unmarked, then mark Fajr as qada. Both count.
- [x] "Surah Kahf · Friday · after Zuhr" appears only on Fridays, highlighted between Zuhr and Asr. It does not appear on other days.
- [x] Renaming Zuhr → Dhuhr and adding Tahajjud updates the ring, insights, and history.
- [x] Insights for a fixture month match hand-calculated totals, including the most-missed prayer.
- [x] Karachi prayer times on a fixture date match a reference source within 1 minute.

**Verified 2026-10-11:**
- Unit tests cover the AlAdhan comparison (Karachi and Lahore, within 1 minute) and a hand-calculated fixture month (125 on time, 5 qada, 20 missed; most missed Isha).
- A browser run against the real API and Supabase passed 16/16, using a throwaway account deleted afterwards: Asr then Fajr as qada; Kahf on Friday after Zuhr only; Dhuhr rename + Tahajjud; insights; Jumu'ah; and location asked once, then silent.
