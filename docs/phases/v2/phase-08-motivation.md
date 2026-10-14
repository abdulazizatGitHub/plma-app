# v2 Phase 8 — Motivation: points, streaks, badges

**Release:** R2 · **Requirements:** REW-01…04 · **Depends on:** 7

## Goal

Rewards that encourage without punishing.

## Scope

- **Server tables:** `points_ledger`, `streaks`, `badge_definitions`, `user_badges`.
- **`RewardsEngine`:**
  - `evaluate`, triggered from sync when an occurrence is newly done
  - `rollStreaks`, run at each user's local midnight
  - `checkBadges`
- **Points:**
  - awarded by priority
  - a bonus for a perfect day
  - the 48 h backfill rule applies
- **Streak freezes:**
  - earn 1 per 7-day streak, hold at most 2
  - used automatically when a day is missed
  - gentle copy when a streak restarts
- **Badge set v1:**
  - 3, 7, 30, and 100-day streaks
  - all prayers for a week
  - first plan finished
  - perfect week
  - planner: planned tomorrow 7 nights in a row
- **Progress page:** points, level, a badges grid, and streaks.
- **Celebration:** a small animation on completion, a perfect day, or a new badge. Respects reduced motion.

## As built (2026-10-14)

- **One scored row per day instead of a ledger** (`reward_days`, migration 0007). A day is re-scored from its entries, so re-syncing, replaying or toggling can't change a total. Closed days are scored once, when they close, and then stay as they are (a later priority edit doesn't re-price them). Open days are re-scored whenever rewards are read. Badges live in `user_badges` (awarded once, `seen_at` for the one-time card).
- **Points:** low 1, medium 2, high 3, critical 5; qada half (rounded up); a late fix 0; going past the goal earns nothing extra; optional items earn too. Perfect day +10 when every required item is done and none is a late fix.
- **Levels:** level n starts at 50·n·(n−1) points (2 at 100, 3 at 300, 4 at 600).
- **Streak:** complete days in a row. Late fixes in the window count; a prayer recovered after its day closed doesn't. Free days are neutral. Freezes: 1 per 7 days, at most 2, used automatically on a closed day that wasn't complete. Today and the fixable days add on once complete and never break it.
- **Badges v1:** 3/7/30/100-day streak, a week of prayers, perfect week (a closed calendar week, every day perfect, at least 5 due), first plan finished. **Planner badge deferred:** nothing records "planned tomorrow" yet.
- **API:** `GET /v1/rewards` (refresh, award, summary), `POST /v1/rewards/seen`. Rewards tables are never accepted from devices.
- **App:** Rewards card at the top of Progress (level ring, points, this week, streak with freezes and best, badge grid with "N more days", "How points work"); one quiet line on Today's card; "+N" floats from the tapped row; confetti and a toast for a perfect day; a card for each new badge, once. Reduced motion: toasts only.

## Acceptance

- [x] Re-syncing the same completions twice leaves the points total unchanged (shared toggle/replay test; API integration 11/11).
- [x] A 7-day streak earns a freeze. Missing day 8 uses it and the streak continues (shared test; API integration; browser).
- [x] A completion backfilled late earns 0 points but still counts in history (API integration).
