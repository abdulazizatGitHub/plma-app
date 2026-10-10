# v2 Phase 9 — Social: friends, groups, leaderboards, sharing

**Release:** R3 · **Requirements:** SOC-01…05, SHR-01 · **Depends on:** 8

## Goal

Accountability with friends, without giving up privacy.

## Scope

- **Friends:** invite by link or email; accept, remove, block.
- **Groups:**
  - create a group
  - invite registered friends, or share a link that goes through sign-up and then join
  - member roles
- **Group goals:**
  - title, tracking, period, reward
  - each member gets a linked item on their own Today (`items.group_goal_id`)
  - progress is aggregated in `group_goal_progress`
- **Leaderboards:**
  - weekly and monthly snapshots
  - individual rankings among friends and within a group
  - group vs group, ranked by average points per active member
  - rewards for the top 3
- **Shares:**
  - send a streak, badge, or achievement to a friend or a group
  - kudos reaction
  - push notification to the recipient
- **Privacy tests:** no endpoint returns another user's item titles unless they were shared.

## Acceptance

- [ ] Two real accounts: A invites B, B signs up via the link and joins, and both complete "70k steps this week". Both earn points and the group's points rise.
- [ ] The leaderboard shows only names, avatars, and points.
- [ ] Sharing a 21-day Fajr streak notifies the friend, and their kudos shows on the sharer's side.
