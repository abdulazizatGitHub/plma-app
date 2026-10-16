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

## 9a+ Snaps and friend streaks (owner, 2026-10-16) — built

- **Snaps (Snapchat-style):**
  - What you can snap:
    - a one-tap check-in of today's rings (top-bar Snap, the Today card's Snap, a friend's row, or "Snap back")
    - an item done today, from its ⋯ menu ("item_done")
    - any earlier share (a day, streak, award or item streak)
  - Snaps are built on the server from stored facts.
- **View once:**
  - A snap opens full-screen once (`POST /v1/snaps/:id/open`), with Kudos and "Snap back".
  - After that the list shows only "Opened".
  - The list marks each snap with a square in its kind's colour: filled when new, hollow once opened.
- **Friend streaks:**
  - 🔥 N with each friend: the days on which you both snapped each other, each on your own day (timezone and day-end hour).
  - Today never breaks a streak. ⌛ shows when fewer than 4 hours are left.
  - An hourly push says "Your 12-day streak with Sara ends in 3h", once per friend per day, respecting quiet hours.
  - Freezes don't apply. A streak that ends gets a gentle "send a snap to start again".
  - Awards for 7, 30 and 100-day friend streaks.
- **Friends list is chat-style:**
  - At-risk streaks first, then by latest snap.
  - Each row shows its status: "New snap · 5m", "Delivered", "They opened your snap", or "Opened".
  - Each row has a Snap / Snap back button.
- **Server:** migration 0010 (`share_recipients.opened_at`, `snap_days`, `snap_nudges`); `apps/api/src/social/streaks.ts`.
- **Checks:**
  - API 15/15: streak counting, restart after a gap, view once, a non-recipient can't open, item_done only once done, friend-streak award.
  - 9a privacy suite still 29/29.
  - Browser 10/10 with two accounts.

## 9b Groups — built (2026-10-16)

- **Groups:**
  - up to 50 members; the owner and admins invite friends or share a group link (sign up, then join, the same device-held claim as friend links)
  - roles: owner / admin / member
  - anyone can leave; if the owner leaves, the longest-standing admin (else member) takes over
  - the owner can delete the group
- **Group goals:**
  - "Each member" or "Together"
  - counted as days done, a count with a unit, or minutes
  - this week, this month, or picked dates
  - optional reward text
  - at most 10 at once
- **Linked items:** each member gets a server-made **linked item** on their own Today (`items.group_goal_id`, tagged "Group · Family") and logs as usual.
  - Members may change its category, priority and reminders.
  - The name, tracking and dates are locked, in the editor and by the sync guard.
  - Leaving or ending a goal archives it, so history stays.
- **Progress:** members see each other's progress on group goals, and nothing else of theirs.
- **Rewards:** given once, after the period closes (hourly sweep, or `npm run jobs:finalize -w @life/api`).
  - Members who met it get the "Group goal met" award.
  - A met "together" goal gives each contributor +10 points (`bonus_points`, included in totals).
- **Group streak:** grows on days every member (at least 2) checked in with "Snap the group". Awards at 7 and 30 days.
- **Boards:**
  - a Groups tab on the leaderboard: my groups by average points per active member, plus public groups (opt-in when creating)
  - the top 3 groups each week and month earn every member a medal
- **Migration 0011:** `groups`, `group_members`, `group_links`, `group_invites`, `group_goals`, `group_goal_results`, `bonus_points`, `group_snap_days` (RLS on, server-only).
- **Checks:**
  - API 26/26, including the acceptance: A creates "70k steps this week", B joins by link, both get the item, progress shows, rewards are given once, and leaving archives the item.
  - Also covered: non-members see nothing; linked items can't be redefined or forged.
  - Browser 8/8 with two accounts.
  - All five API suites (93 checks) pass together.

## Acceptance (9b)

- [x] Two real accounts: A invites B, B joins via the link, and both log toward "70k steps this week" (their own Today items). A met goal gives awards, and a "together" goal gives its points once.
- [x] Group vs group uses average points per active member.
