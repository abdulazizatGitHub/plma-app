# Preprod QA: findings and test plan

Preprod: <https://mehrmah.vercel.app>. The API is `mehrmah-api.onrender.com`, and Supabase is **PLMA-preprod-app** (`onbknuqehjxkumdtpyjj`).

This file is a living record. Each finding gets an ID here and a row in [PROJECT.md](../../PROJECT.md) → Bugs. A finding is closed only when its fix is merged, deployed to preprod and re-checked.

**Severity:** critical (data loss, security, unusable) · major (a core flow is wrong or confusing) · minor · trivial.

---

## Open findings

### BUG-005: The theme survives sign-out and carries over to the next account (major)

- **Found:** 2026-11-09, by the owner on preprod.
- **Steps:**
  1. Sign in as account A.
  2. Profile → Theme and mode → pick a different theme or mode.
  3. Sign out. The sign-in page still uses A's theme.
  4. Sign in as account B, or create a new account. B also gets A's theme.
- **Expected:**
  - The theme is a per-account preference.
  - Signing out returns the device to the default (Sky, system mode).
  - Signing in applies that account's own theme, on any device.
- **Cause:** the theme and mode are kept only in the browser's `localStorage` (`theme-provider.tsx`, `theme-init-script.ts`). They are device-wide, not part of the account. `signOut` in `auth-provider.tsx` wipes the offline store but not these keys.
- **Fix direction:**
  - Save the theme and mode in `user_settings`, so they sync and follow the account.
  - Keep `localStorage` only as a fast first paint for the signed-in account.
  - Reset to the default on sign-out.
  - Needs a small migration: two columns on `user_settings`.
- **Also check:** anything else device-wide that should be per-account. Examples are the install banner snooze, the tour "seen" flag, the Getting started dismissal, and reminder permission prompts. Decide which should be per-account and which per-device.

### BUG-006: The snap viewer's colours and layout break outside light mode, and on a computer (major)

- **Found:** 2026-11-09, by the owner on preprod, opening a snap from a notification. See the screenshot in the owner's report: a light grey overlay, and the rings drawn on a dark disc with "beaded" segments.
- **Steps:** with a dark mode or a personal theme, open a snap from Activity or from a notification.
- **Expected:** a clear full-screen card in the same look in every theme. The rings are drawn on the card's own surface, with the normal track colour. On wide screens the content and buttons sit in a centred column of phone width.
- **Cause:** `snap-viewer.tsx` assumes an "inverted" scheme, `bg-ink/90 text-bg`. In dark mode `ink` is light and `bg` is dark, so the overlay turns light grey with dark text. The ring art sits on `bg-surface`, which is dark in dark mode, so the empty prayer segments read as dark beads. The action row spans the full window width on desktop.
- **Fix direction:**
  - Give the viewer its own fixed tokens (a scrim plus a card), or use the normal `bg`/`ink`/`surface` tokens without inverting them.
  - Wrap the content and actions in a `max-w-md` column.
  - Check every share kind (day, streak, award, item streak, item done) in all 4 themes × light/dark, at phone and desktop widths.
- **Also check:** opening from a push notification deep link (`/activity`). The viewer should open on the right snap, and the page behind it shouldn't flash.

### BUG-007: Nothing says where snaps arrive; there's no per-friend view (major, UX)

- **Found:** 2026-11-09, by the owner. "Where should these snaps be displayed, is there an inbox of the friends?"
- **Today:**
  - Received snaps, kudos and friend requests are listed on **Activity** (`/activity`), reached from the **bell** in the top bar.
  - The Friends list shows the last snap per friend (chat-style), but nothing labels it as an inbox.
  - There's no thread for one friend.
- **Expected (to be agreed with the owner):** an obvious place to see snaps, for example:
  - name the bell's page "Snaps" in the header and the menu
  - an unread count on the bell
  - tapping a friend opens their snaps (sent and received, with Opened or Delivered)
  - a tour step and a Help article pointing there

  Decide whether Activity stays one combined list or splits into Snaps and Requests tabs.
- **Fix direction:** the owner decides the shape (combined inbox, or a per-friend thread, or both). Then: update `activity/page.tsx`, the Friends row tap target, the tour step `activity`, and the Help article "Snaps and friend streaks".

### BUG-008: The snap sheet doesn't show who you've already snapped today (major, UX)

- **Found:** 2026-11-09, by the owner. After sending today's snap, the sheet still suggests the same friends, as if nothing had been sent.
- **Expected:**
  - Each friend shows today's status:
    - **Sent today** (and **They sent you one** / **Both done** for streak days)
    - **Not yet**, with ⌛ when the streak ends soon
  - Friends already snapped today drop below the ones still to do.
  - After sending, a confirmation names who received it.
  - Sending again is allowed, but clearly marked as a second snap.
- **Cause:** the API already returns `streak.today = { me, them }` for each friend (`packages/shared/src/v2/snaps.ts`), but `share-sheet.tsx` shows only the 🔥 count. It also doesn't refresh the friends list after a send.
- **Fix direction:**
  - Show the today state on each row and sort by it.
  - Refresh the friends cache after a send.
  - Use the same badge on the Friends list rows.

---

## Next: a wider test pass

The owner asked for a broader hunt for issues like these across every module. Run it on preprod with **two or three real accounts** (Gmail "+" aliases are fine), on a **phone** (Android Chrome, iPhone Safari, installed and not installed) and on a **computer**. Use all **4 themes × light/dark**.

Log every finding above, with steps, expected, cause and fix direction.

### Account and session

- Sign up:
  - a code email arrives from **Mehrmah**
  - a wrong code, an expired code, and resend with its cooldown
  - an email that already has an account (now says so)
- Sign in:
  - wrong password
  - sign in on two devices at once
- Forgot password: the code arrives, the new password works, and the old one no longer does.
- Sign out:
  - your data, theme and caches are gone from the device (BUG-005)
  - the next account starts clean: no friends, snaps, groups or rewards from the last account in memory or the offline store
- Session expiry or an offline sign-in, then reconnecting.

### First run and help

- Intro → profile → day and prayer → interests → items → ready → tour.
- Skip at every step. A refresh mid-way resumes in the right place.
- Getting started card: each task ticks itself, it hides after 14 days, and Dismiss works.
- Help: search works, and every article matches what the app does now (button labels, menu paths).

### Today and items

- Add each kind:
  - task, habit, count, minutes, checklist, routine
  - undated task → Pending
  - a time of day
- Mark done, undo, skip, move, missed, and late (after the day).
- Behaviour around midnight and the day-end hour (1–4 AM).
- Two devices editing the same item offline, then syncing.
- Categories: create, rename, recolour, reorder, archive, starter packs.

### Prayer

- Location: allow, deny, pick a city, change.
- On time, qada and missed, including yesterday's prompt and Isha after midnight.
- Adjustments and fixed times. Hijri offset.

### Plans and reminders

- Plans: steps, waits-for locks, cadence warnings.
- Reminders, on Android and on an installed iPhone app:
  - a reminder arrives
  - **Done** and **Snooze** on the notification
  - quiet hours, category mute, the global switch
- Reminders after the API has been idle: the Render free tier with the cron ping.

### Progress and rewards

- Rings fill correctly per day. A perfect day gives +10. Points by importance; qada counts half.
- Streak and freezes. Awards appear once, and the celebration doesn't repeat.
- Week and month views and the monthly challenge.

### Friends, snaps, groups and privacy

- Add a friend by link and by @username. Accept, decline, remove, block.
- Snaps:
  - check-in, item done, award, streak
  - each snap opens once
  - Kudos, Snap back
  - friend streak 🔥 and ⌛
  - BUG-006 to BUG-008
- Visibility (Everyone, Friends, Selected, Only me): check what each other account can see.
- Groups:
  - create, invite by link and by friend
  - roles, leave, delete
  - goals (each or together, every tracking kind)
  - group snap and streak
  - the board
- Leaderboards: friends, everyone, groups; week and month.

### PWA and offline

- Install banner and guide on each platform. The banner hides once installed.
- Airplane mode: Today works, changes sync after reconnecting, and the social pages show their last copy.
- An update after a new deploy: the old service worker gets replaced.

### Look and accessibility

- Every screen in 4 themes × light/dark, at 360 px, tablet and desktop widths.
- Keyboard and screen-reader labels on sheets and dialogs. Reduced motion.

---

## Closed findings

| ID | Closed | Summary | Fix |
|----|--------|---------|-----|
| (preprod) | 2026-11-08 | A sign-up with an email that already had an account showed "We sent a code" and never sent one | `auth-provider.tsx` now says the email already has an account (commit on `fix/signup-existing-email`) |
| (preprod) | 2026-11-09 | Sign-up emails came from Supabase with a link, not a Mehrmah code | Preprod env pointed at the old dev project (keys swapped, plus a duplicate `DATABASE_URL`); now on PLMA-preprod-app with Gmail SMTP and the code templates |
