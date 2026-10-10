# Life v2 — Product requirements document

| | |
|-|-|
| **Product** | Life: a personal planner and tracker for faith, health, study, and work, with friends later |
| **Version** | v2 (supersedes the v1 habit dashboard) |
| **Status** | Draft for owner review, 2026-10-07 |
| **Owner** | abdulazizatGitHub |
| **Detail** | Numbered requirements: [REQUIREMENTS_V2](../requirements/REQUIREMENTS_V2.md) · Architecture: [SYSTEM_DESIGN](../architecture/SYSTEM_DESIGN.md) · Plan: [DEVELOPMENT_PLAN](../plan/DEVELOPMENT_PLAN.md) · Visuals: [DESIGN_SYSTEM_V2](../design/DESIGN_SYSTEM_V2.md) |

---

## 1. Problem

People who balance prayer, health, study, and side work like content creation juggle several apps:

- a habit tracker for streaks
- a to-do app for one-off tasks
- a prayer app
- notes for collab plans

Each one assumes every item must be done every day. A missed Fajr or a day with no shoot feels like failure, so people stop using the tracker.

The current Life app tracks a fixed set of habits on a decorative dashboard. The owner finds it visually heavy, and it can't hold one-off tasks, plans, or user-defined sections.

## 2. Vision

> Open the app and see exactly what today holds — what's left, what's in progress, what's done — in sections *you* defined. Plan tomorrow tonight. Skip what doesn't fit without losing your 100%. Stay motivated with streaks, badges and, later, friends.

## 3. Users

| Persona | Needs |
|---------|-------|
| **Student creator** (primary; matches the owner) | Five prayers and Quran goals, university deadlines (quiz, assignment, FYP), restaurant collabs with shoot, edit, and post dates, steps and water. Plans at night, misses things sometimes, wants honest but kind progress. |
| **Practising professional** | Prayer times by location, gym routine, meal and water tracking, work tasks; reminders that matter and nothing noisy |
| **Accountability friends** (R3) | A small group sharing goals ("70k steps this week", "all prayers on time"), leaderboard, kudos |

## 4. Goals and success metrics

| Goal | Metric (first 8 weeks after R1) | Target |
|------|---------------------------------|--------|
| Today is useful daily | Days the app is opened per active user per week | ≥ 5 |
| Planning ahead happens | Share of active days with at least one item created the day before | ≥ 40% |
| Flexibility keeps people going | Users active in week 4 who were active in week 1 | ≥ 50% |
| Reminders help, not annoy | Reminded occurrences completed within 60 min | ≥ 35% |
| | Notification opt-out rate | < 15% |
| Prayer tracking works | Users with the prayer block who log at least 3 prayers per day on average | ≥ 60% |

**Non-goals for v2:**

- calendar sync with Google or Apple
- team or work project management
- public social feed
- payments
- AI planning

## 5. Scope by release

| Release | Phases | Contents |
|---------|--------|----------|
| **R0 Plan** | 0 | This pack; UI kit from the reference images |
| **R1 Personal MVP** | 1–5 | Accounts and new data model; **Today** (To Do / In Progress / Done, skip, move, pending, plan ahead); **Categories and items** (tracking, priority, schedules, routines, history basics); **Spiritual** (custom prayer block, any-order one tap, prayer times, anchored Quran items, prayer insights); **Plans** (content collab, university, cadence) |
| **R2 Habit loop** | 6–8 | Reminders with escalation; History and analytics; Points, streaks with freezes, badges |
| **R3 Social** | 9–10 | Friends, groups, group goals, leaderboards, sharing streaks; platform challenges |
| **R4 Native and library** | 11–12 | Capacitor app with real alarms and an external share image; public template library |

## 6. Experience

### 6.1 Navigation

Bottom bar: **Today · Categories · (+) · Progress · Profile**.

![Screen map](../architecture/diagrams/screen-map.png)

### 6.2 Key flows

**First run**

1. Sign up.
2. "What do you want to track?" offers starter categories (Spiritual, Physical, Health, Mental, Content creation, University, Work) plus "Start empty".
3. Optional location for prayer times.
4. Optional notifications, with an install-to-Home-Screen hint on iPhone.
5. Land on Today.

**Morning: Today**

- Header: date, greeting, and a small day ring.
- Three status tiles (To Do · In Progress · Done) with counts.
- Below them, lists grouped by status, with the prayer row pinned where the user put it.
- Interactions:
  - Tap a circle to finish an item.
  - Tap **+500** or type **10000** on steps.
  - Long-press for Skip, Move to tomorrow, Move to date, Pending, Edit.

**Night: plan tomorrow**

- Tap the date strip, then tomorrow, then **+**.
- Add "Shoot at Café X, 4 pm, high priority, remind 2 h before".
- It shows on tomorrow's To Do immediately.

**Spiritual**

- Category detail starts with the "Daily prayers" ring: five chips, each a one-tap toggle in any order.
- Below it, items such as "Surah Kahf · Fridays · after Zuhr", which shows on Fridays only and highlights after Zuhr.
- Tap the prayer block to see insights: "This month 128/150. Most missed: Fajr (9). Strongest: Maghrib (100%). Try a Fajr reminder 10 min after adhan."

**Content collab plan**

- Use **+**, then Plan, then the *Content collab* preset.
- Fill in restaurant, shoot date, and edit date.
- Post is locked until **Payment cleared** is ticked.
- If the category has the cadence "post weekdays Tue/Fri, 1-day gap", picking Thursday shows "Thursday isn't a post day. Next: Fri 17 Oct."

**University**

- The *University* preset adds a course name.
- Quick-add Quiz, Assignment, Presentation, Teacher meeting, or FYP meeting, each with a date and time.
- They show on Today on that date and on the Progress page by course.

### 6.3 Rules users will notice

1. **100% is reachable.** Skipped, moved, pending, and optional items don't count. A day with nothing required is 100%.
2. **Nothing is forced.** No default habits, no fixed prayer order, no mandatory categories.
3. **Windows guide, never lock.** "After Zuhr" items highlight after Zuhr but can be ticked any time.
4. **Kind streaks.** Freezes cover the occasional miss. A broken streak says "Start a new streak", never shames.
5. **Private by default.** Friends see points and shared achievements, never your item list.

## 7. Functional requirements (summary)

The full table with IDs, priorities, and phases is in [REQUIREMENTS_V2 §5](../requirements/REQUIREMENTS_V2.md#5-final-requirements).

| Area | Must-haves |
|------|------------|
| Today (TOD) | Status buckets, tiles, ring, date strip, one-tap and stepper input, prayer row |
| Categories (CAT) | User CRUD and reorder, inline expand, "nothing today" without penalty |
| Items (ITM) | task / habit / goal / plan / group, children, priority, optional, extra fields, detail page |
| Tracking (TRK) | check, quantity with ± step and typed value, duration, checklist |
| Scheduling (SCH) | once, repeat rules, prayer anchors, day parts, pending, plan any future date |
| Flexibility (FLX) | skip, move, pending, progress rule |
| Prayer (PRY) | custom set, order, and placement; ring; any order; prayer times; Quran anchors; insights |
| Plans (PLN) | dated steps, dependencies, venue, cadence warnings, university preset |
| Reminders (REM) | per-item, priority escalation, Done / Snooze, quiet hours; alarms in R4 |
| History (HIS) | heatmap, bars, rates, streaks, summaries, backfill |
| Motivation (REW) | points, streaks with freezes, badges, celebration |
| Social (SOC/SHR/CHL) | friends, groups, group goals, leaderboards, shares and kudos, platform challenges |

## 8. Non-functional requirements

- **Offline-first:** works with no network; syncs later. Today renders from the device in under 1 s.
- **Privacy:** data isolated per account; server-side ownership checks; social sees points only.
- **Accessibility:** WCAG AA contrast, 44 px targets, labelled icon buttons, reduced motion.
- **Time correctness:** per-user timezone; local dates; UTC instants; correct across DST.
- **Platforms:** modern Chrome, Edge, Safari, and Firefox. Installable PWA. iOS push only when installed.

## 9. Design direction

From the owner's 4 reference images (`UI Images/`):

- light lavender-grey canvas, white rounded cards, soft shadows
- pastel status colors (coral To Do, peach In Progress, sage Done)
- Poppins, thin rings with the % inside, slim rounded bars
- a center **+** in the bottom bar

Details and tokens are in [DESIGN_SYSTEM_V2](../design/DESIGN_SYSTEM_V2.md).

## 10. Dependencies

| Dependency | Use | Note |
|------------|-----|------|
| Supabase (Postgres, Auth) | Data and accounts | Already in use for Postgres |
| adhan-js | Prayer times on device and server | MIT, astronomical algorithms (Meeus) |
| web-push | VAPID push from the API | VAPID keys in env |
| pg-boss | Scheduled jobs | Uses the same Postgres |
| Capacitor (R4) | Native wrapper, local notifications | Requires app-store accounts |

## 11. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Reminders on iPhone need install; EU standalone PWAs get no push | Install prompt, in-app reminder list, native wrap in R4 |
| Flexibility could make tracking meaningless | Skips and moves are visible in history ("skipped 3× this week"); points require completion |
| Too many options overwhelm a "simple" app | Quick add needs only a title; everything else sits behind "More options". Presets fill sensible defaults. |
| Social features cause comparison stress | Opt-in groups; per-member average for group ranks; no public global board by default |

## 12. Owner decisions (answered 2026-10-08)

1. **Prayer times:** default is the **Karachi method with Hanafi Asr**, synced to the user's location, with per-prayer minute offsets. See [PRAYER_TIMES.md](../guides/PRAYER_TIMES.md).
2. **Qada:**
   - An unprayed prayer stays unmarked and becomes **missed** when the day ends.
   - Users can later mark past missed prayers as **prayed (qada)** to recover them.
   - Qada counts in prayed totals with a qada mark. It does not extend on-time streaks.
3. **Leaderboards:**
   - Friends and groups come first, then a local friends board and a **global** board.
   - A **visibility setting** (Only me / Friends / Everyone) controls who sees a user's achievements and progress.
4. **Sign-in:**
   - **Email and password** at launch (Phase 1).
   - **Google** is added later, after the Google Cloud console and billing checks in [AUTH_SETUP.md](../guides/AUTH_SETUP.md).
