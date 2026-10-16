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

## Split (owner, 2026-10-16)

- **9a — built 2026-10-16:** profile (name, @username, avatar colour), visibility (Everyone / Friends / Selected friends / Only me), friends (invite link, @username, requests, remove, block), Friends and Everyone leaderboards by points for the week and month, podium awards for the top three, shares (a day's rings, the day streak, an award, any item's streak) with kudos, Activity, and social push notifications.
- **9b — next:** groups, roles, group links, group goals (`items.group_goal_id`, `group_goal_progress`), and group-vs-group by average points per active member.

## 9a as built

- **Privacy:** one rule (`apps/api/src/social/privacy.ts`, `canSeeRule`). Others see a name, @username, avatar colour, points, level, streak and awards, and only when the owner's visibility allows it. Item titles leave their owner only inside a share the owner sent. Blocks hide both ways and aren't revealed.
- **Invites:** a personal link shared from the phone's share sheet, with no email service. Opening it signed out stores the code on the device; once the person signs in or up and finishes onboarding, the app claims it and they're friends. "New link" revokes the old one.
- **Shares are built by the server from stored facts.** A client can't send a title or a number; extra fields are refused. Up to 30 shares and 20 friend requests a day.
- **Leaderboards** follow the page's week or month. Everyone shows the top 50 plus you; Friends shows you and the friends who let you see them.
- **Podium awards:** gold, silver and bronze on the Everyone board, and on each person's own Friends board when at least 3 people scored. Given once per finished period (Monday weeks and calendar months, finalised 4 days after they end) by the hourly sweep.
- **Migration 0009:** `users.username` and `avatar_color`; the `friendships`, `blocks`, `invite_links`, `visibility_allow`, `shares`, `share_recipients`, `kudos` and `podium_periods` tables (RLS on, server-only); the `selected` visibility value.
- **Fixed on the way:** the API's CORS setup only allowed GET/HEAD/POST, so the browser blocked the profile save (PATCH) and the allow-list (PUT). Found by the browser check.

## Acceptance (9a)

- [x] A invites B by link; B signs in through it and they're friends (browser, two accounts).
- [x] The leaderboard shows only names, avatars and points (API key check; browser).
- [x] Sharing a 21-day Fajr streak reaches the friend, and their kudos shows on the sharer's side (API 29/29; browser 11/11).
- [x] No social response contains an item title except a share sent to that person (privacy suite).
