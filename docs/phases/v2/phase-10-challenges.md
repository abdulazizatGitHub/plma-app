# v2 Phase 10 — Platform challenges

**Release:** R3 · **Requirements:** CHL-01, CHL-02 · **Depends on:** 8

## Goal

The platform sets weekly and monthly goals. Users who finish in time earn rewards.

## Scope

- **Server tables:** `challenges` and `challenge_entries`.
  - Each challenge has a rule, stored as JSON and evaluated by `RewardsEngine`.
  - Example rule: `{metric: 'prayers_done', gte: 30, period: 'week'}`.
- **User side:** a challenge list on Progress, a join button, and a progress bar.
- **Admin:**
  - a minimal `/admin/challenges` screen, gated by the admin claim
  - admins can create, schedule, and close challenges
  - the `challenges.close` job awards points and badges

## Acceptance

- [ ] A weekly challenge completed before the deadline awards points and a badge exactly once.
- [ ] Completing it after `ends_at` awards nothing.
- [ ] A non-admin cannot reach the admin routes (API test).
