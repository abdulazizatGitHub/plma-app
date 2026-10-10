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

## Acceptance

- [ ] Re-syncing the same completions twice leaves the points total unchanged (idempotency test).
- [ ] A 7-day streak earns a freeze. Missing day 8 uses it and the streak continues.
- [ ] A completion backfilled 3 days late earns 0 points but still counts in history.
