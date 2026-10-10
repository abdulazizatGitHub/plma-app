# Life v2 — Requirements reconciliation

Captured **2026-10-07**. The owner's new direction is compared against everything documented or built before it. The final, numbered requirement set is assigned to phases.

**Precedence:** where they disagree, this file supersedes [CLIENT_REQUIREMENTS.md](./CLIENT_REQUIREMENTS.md) (original CRD and Addendum A). Addendum B in that file points here.

Related: [PRD](../product/PRD.md) · [System design](../architecture/SYSTEM_DESIGN.md) · [Development plan](../plan/DEVELOPMENT_PLAN.md) · [Design system v2](../design/DESIGN_SYSTEM_V2.md)

---

## 1. Current requirements (before 2026-10-07)

### 1.1 Built (phases 01–05)

| Area | What exists today | v2 verdict |
|------|-------------------|------------|
| Platform | npm monorepo: Next.js 16 PWA (Serwist), Fastify API, Drizzle + Postgres (Supabase), sql.js offline store, pull/push sync, 185 tests | **Keep** |
| Data model | `habit_definitions` + `habit_logs`; one log per habit per day; JSON payloads | **Replace** with Category → Item → Occurrence (§6). History is migrated. |
| Habits | 9 seeded system habits auto-added for the one built-in Owner | **Replace.** They become optional starter templates. |
| Home | Big ring, 7-day bars, "Up next", numbered category sections with 2-column tiles | **Replace** with To Do / In Progress / Done |
| Prayer | Fixed 5 prayers; Prayed / Missed / Undo; any order; month heatmap and report | **Keep** the any-order logic and stats. The fixed list and screen are replaced. |
| Quran | Mulk nightly, Kahf on Fridays | **Becomes** ordinary user items with prayer anchors |
| Health | Steps (manual, quick add, goal), water (glasses), exercise (type and duration), sleep (bed/wake) | **Becomes** ordinary items with quantity / duration tracking. History is migrated. |
| Visual design | Space Grotesk + Space Mono; 4 palettes from award sites; tiles; no side bars | **Replace** with the reference-image design ([DESIGN_SYSTEM_V2](../design/DESIGN_SYSTEM_V2.md)) |

### 1.2 Documented but not built

| Source | Requirement | v2 verdict |
|--------|-------------|------------|
| 06A / ACC-01…03 | Multi-user accounts, data isolation, per-user offline cache | **Keep.** This is Phase 1 now. |
| 06B / CUS-01…04 | Start empty, template gallery, own habits/goals/targets, own templates, Home driven by own data | **Keep, generalised:** categories and items replace "habits" |
| 07 | Make bed, no-phone timer, plan tomorrow | **Merged.** The first two become user items; "plan tomorrow" becomes SCH-06 / REM-06. |
| 08 | Daily tasks, weekly goals, monthly goals (e.g. savings) | **Merged** into ITM (task / goal types) |
| 09 | Content pipeline Idea → To Shoot → Editing → Ready → Scheduled → Uploaded, enforced | **Replaced** by flexible plans (PLN) |
| 10 | Calendar day detail | **Merged** into the Today date strip and history |
| 11 | Analytics dashboard | **Kept** as Progress page (HIS) |
| 12 | Per-category reminder toggles, quick add | **Changed** to per-item reminders with priority escalation (REM). The **+** button covers quick add. |
| 13 | Polish and deploy | **Kept**, spread across phases |
| 14 / LIB-01…05 | Public template library | **Kept** as v2 Phase 12. Provenance fields stay in the schema. |

---

## 2. New requirements (owner, 2026-10-07)

Paraphrased from the owner's message. Each statement is traced to numbered requirements in §5.

| # | Owner statement |
|---|-----------------|
| S1 | "I don't like this current interface and typography, I want simple interfaces." See the 4 reference images in `UI Images/`. |
| S2 | When Home loads it shows today's **To Do, In Progress, Completed** tasks. |
| S3 | Another page shows the sections (categories). I can add, delete, and edit categories such as spiritual, physical, content creation, mental, and health. Users create their own. |
| S4 | Under each category I can add tasks and goals: prayer, Quran, and sadqa; steps and gym (with a gym routine); diet, meals, and water. |
| S5 | For each task or goal I choose **what to track** and **how important** it is (low / medium / high / critical). Higher importance adds more tracking and "make sure it is completed". |
| S6 | Reminders that notify, like alarms. |
| S7 | Divide the day. Add prayers into the day. Daily tasks vary per day and per user. People write them in the morning or the night before. |
| S8 | Badges and rewards for motivation. |
| S9 | Expanding a category shows its details. Clicking a task shows its details and history. |
| S10 | Content collab: add the day, date, and restaurant; shoot day, edit day, post after payment clears; optional reminders. |
| S11 | University: assignments, quizzes, presentations, teacher meetings, FYP tasks and meetings. Varies per user. |
| S12 | Not every task must be completed. Unfinished ones can be left and the day can still be **100%**. |
| S13 | A category with nothing upcoming (no collab, no shoot) is fine. Later: cadence such as "post with a one-day gap" or "fixed shoot / edit / post weekdays". |
| S14 | Spiritual starts with daily prayers, but not fixed: customise them, their placement, and their location. Expanding shows Fajr, Zuhr, Asr, Maghrib, Isha (customisable), with a ring and **one-click** tick. |
| S15 | Prayers can be marked **in any order**. A missed Fajr doesn't block marking Zuhr or Asr. |
| S16 | Quran tilawat or a specific surah with a time, prayer, or day: "Surah Kahf on Friday after (or before) Zuhr". The task is active only on that day or after that prayer. |
| S17 | Physical: steps, water, gym, and other activities. Steps accept a direct value like 10,000, **+/−** buttons of 500 or 1,000, and typed input. |
| S18 | Every task has detailed history. For prayer: total prayed per week and month, which prayer is missed most, which is regular, and where to improve. |
| S19 | Add tasks for **tomorrow** any time (not tied to the date changing). Mark non-mandatory tasks **pending** or **shift** them to the next day or another day. |
| S20 | Future: groups. Invite registered friends, or invite people to sign up and join. Group goals and tasks; completers and groups are rewarded. |
| S21 | Leaderboards for individuals and groups, with rewards. |
| S22 | Platform-set weekly and monthly goals. Finishing in time earns points and badges. |
| S23 | Later: share a streak or achievement (e.g. a prayer streak) with friends in the app. |

---

## 3. Conflicts and resolutions

New direction wins unless stated. Each resolution has a DECISION.md entry dated 2026-10-07.

| # | Current | New | Resolution |
|---|---------|-----|------------|
| C1 | Space Grotesk + Space Mono, award-site palettes, tile Home; memory rule "colors from `docs/design-references`" | Simple UI from `UI Images/` (S1) | **Replace.** Tokens are sampled from the 4 reference images. Font is **Poppins**, matching ref 3. The rule "colors come from real sources, never invented" is kept; the source is now `UI Images/`. |
| C2 | Home = ring, Up Next, numbered category tiles | Today = To Do / In Progress / Done (S2) | **Replace.** Day progress becomes a ring in the header. Status tiles plus three lists follow ref 2 / ref 3. |
| C3 | Nav: Home · Goals · Calendar · Progress · More | Home + categories page + history (S2, S3, S9) | Nav becomes **Today · Categories · + · Progress · Profile**. Calendar becomes the date strip on Today and the item history. |
| C4 | Fixed CRD items: Mulk nightly, Kahf Friday, 10k steps, 8 glasses, 6:00 wake, make bed, no-phone hour | Everything user-defined (S3, S4, S14) | They become **starter templates**, never auto-added (also CUS-01). |
| C5 | `habit_logs` unique (habit, date); habits only | One-off tasks, goals, plans, future dates, moves, sub-items (S4, S10, S19) | New model: **Category → Item (tree) → Occurrence**. Occurrence is both the dated instance and its log. Existing logs are migrated (§6). |
| C6 | Day completion counts every scheduled habit | Unfinished items may be left; 100% still possible (S12, S13) | **Progress rule:** % = done ÷ required. Skipped, moved, pending, and optional items are not required. Nothing required means 100%. |
| C7 | Content pipeline with an enforced fixed status chain | Custom dated steps, venue, payment gate, cadence (S10, S13) | **Generic plans:** steps are child items with dates and dependencies. Content and University are presets. Cadence produces warnings and suggestions, not hard blocks. |
| C8 | Prayer: fixed 5, Prayed/Missed buttons, own page | Customisable set, order, and placement; ring; one tap; anchors (S14–S16) | Keep the any-order rule, Missed state, and report maths. The list becomes a **group item** with child prayers. Prayer times come from **adhan-js** (location and method in settings) or manual times. |
| C9 | Reminders: per-category toggles (old Phase 12) | Per-item reminders "like alarms" (S5, S6) | Per-item reminders with **priority escalation**, delivered by **Web Push** now. True alarms need the **Capacitor** wrap (Phase 11), because a PWA cannot ring. On iPhone, push requires the app installed to the Home Screen. |
| C10 | Separate phases 07/08/09/10 | One item engine | Folded into v2 phases. Old phase docs move to `docs/phases/archive/`. |
| C11 | Phase 14 public template library | Not mentioned | **Kept** as v2 Phase 12, after social. Provenance columns stay from Phase 1. |
| C12 | ACC-02: all data private | Groups, leaderboards, sharing (S20–S23) | **Private by default.** Others see only points, group-goal progress, and things explicitly shared. |
| C13 | Sleep logged as bed/wake on the wake-up date | Not mentioned | Kept as an optional **starter template** (duration tracking; bed/wake in `occurrence.detail`). History is migrated. |
| C14 | Memory rule: "never invent colors" | Owner supplied new references | Still applies. Dark mode has no reference image, so its values are **derived** and marked `(d)`, and the owner reviews them in Phase 0. |

---

## 3a. Owner answers (2026-10-08)

| # | Question | Answer |
|---|----------|--------|
| A-1 | Prayer calculation default | **Karachi method + Hanafi Asr**, synced to the user's location. No API key is needed; see [PRAYER_TIMES.md](../guides/PRAYER_TIMES.md). Becomes PRY-10. |
| A-2 | Qada | A prayer not prayed is left unmarked and becomes **missed** at day end. Users can later mark past missed prayers as **qada** to recover them. Becomes PRY-03, PRY-08, PRY-09. |
| A-3 | Leaderboards | Friends and groups first, then a local friends board and a **global** board. Each user chooses whether their achievements and progress are visible. Becomes SOC-04 and SOC-06. |
| A-4 | Sign-in | **Email and password first** (Phase 1). **Google later**, after checking the Google Cloud console and billing constraints; see [AUTH_SETUP.md](../guides/AUTH_SETUP.md). |

## 4. Glossary

- **Category:** a user-named section (Spiritual, Physical, Content creation, University…).
- **Item:** anything inside a category.
  - `task`: one-off, e.g. "Quiz — Data Structures, 12 Oct"
  - `habit`: recurring, e.g. "Steps 10,000 daily"
  - `goal`: target over a period, e.g. "Save Rs 20,000 this month"
  - `plan`: multi-step with dates, e.g. "Collab — Café Aylanto"
  - `group`: container, e.g. "Daily prayers"
- **Occurrence:** one dated instance of an item, with its status and value. Statuses: `todo · in_progress · done · skipped · moved · missed`. A task with no date is **pending**.
- **Required:** an occurrence that counts toward the day %. It must not be optional, skipped, moved, or pending.
- **Anchor:** ties an item to a time, a prayer ("after Zuhr"), or a day part ("Morning").

---

## 5. Final requirements

**MUST** = needed for the phase to be accepted. **SHOULD** = expected and droppable only with an explicit owner OK.

### TOD — Today (home)

| ID | Requirement | Pri | Phase | From |
|----|-------------|-----|-------|------|
| TOD-01 | Home opens on **today** and shows required and optional occurrences in three groups: **To Do**, **In Progress**, **Done** | MUST | 2 | S2 |
| TOD-02 | Status tiles at the top show counts. Tapping a tile filters the list. | MUST | 2 | S2 |
| TOD-03 | A day ring shows % by the progress rule (FLX-04) | MUST | 2 | S12 |
| TOD-04 | A date strip shows past and future days. Any date can be viewed and planned. | MUST | 2 | S7, S19 |
| TOD-05 | One-tap complete for checks. Inline **+ / −** and typed value for quantities. | MUST | 2 | S14, S17 |
| TOD-06 | Optional grouping by **day part** (e.g. After Fajr / Morning / Evening) instead of status | SHOULD | 4 | S7 |
| TOD-07 | The prayer block shows on Today as one compact row of prayer chips, at the position the user chooses | MUST | 4 | S14 |

### CAT — Categories

| ID | Requirement | Pri | Phase | From |
|----|-------------|-----|-------|------|
| CAT-01 | Create, rename, recolor, re-icon, reorder, archive, and delete categories | MUST | 3 | S3 |
| CAT-02 | Starter suggestions (Spiritual, Physical, Health, Mental, Content creation, University, Work). None are forced; a new account starts empty. | MUST | 3 | S3, CUS-01 |
| CAT-03 | The Categories page lists categories with today's ring and counts. A category **expands inline** to show its items, and tapping opens the category detail. | MUST | 3 | S9 |
| CAT-04 | A category with nothing due shows "Nothing today" and is excluded from the day % | MUST | 2 | S13 |
| CAT-05 | Items within a category can be reordered and pinned. A block such as Daily prayers can be placed first. | MUST | 3 | S14 |

### ITM — Items (tasks, habits, goals, plans, groups)

| ID | Requirement | Pri | Phase | From |
|----|-------------|-----|-------|------|
| ITM-01 | Item types: task, habit, goal, plan, group | MUST | 3 | S4 |
| ITM-02 | Items can have **children**: a gym routine has exercises, Daily prayers has prayers, a plan has steps | MUST | 3 | S4, S14 |
| ITM-03 | **Priority** is low, medium, high, or critical. It drives sort order, reminder defaults (REM-02), and an end-of-day check for critical items. | MUST | 3 | S5 |
| ITM-04 | **Optional** flag: never counts toward the day % (critical items cannot be optional) | MUST | 2 | S12 |
| ITM-05 | Free notes plus typed extra fields per preset: venue, platform, course, teacher, amount | MUST | 3 | S10, S11 |
| ITM-06 | Edit, archive, and delete. Archived items keep their history. | MUST | 3 | S3 |
| ITM-07 | **Item detail:** today's control, schedule, reminders, and history (HIS-01) | MUST | 3 | S9 |

### TRK — What is tracked

| ID | Requirement | Pri | Phase | From |
|----|-------------|-----|-------|------|
| TRK-01 | **Check:** done or not done | MUST | 2 | S4 |
| TRK-02 | **Quantity:** unit and target (10,000 steps, 8 glasses, Rs 20,000). **+ / −** buttons with a configurable step (500 / 1,000 / 1), plus **direct typed entry** | MUST | 3 | S17 |
| TRK-03 | **Duration:** minutes, with an optional target | MUST | 3 | S4 |
| TRK-04 | **Checklist:** sub-steps ticked within one occurrence, such as meals or a short routine | SHOULD | 3 | S4 |
| TRK-05 | **In Progress** means a quantity above 0 but below target, or a task marked *Started* | MUST | 2 | S2 |

### SCH — When things happen

| ID | Requirement | Pri | Phase | From |
|----|-------------|-----|-------|------|
| SCH-01 | One-off on a date, with an optional time | MUST | 2 | S10, S11 |
| SCH-02 | Repeating: daily, chosen weekdays, every N days, or monthly. Optional start and end dates. | MUST | 3 | S4, S13 |
| SCH-03 | **Prayer anchor:** before, at, or after a named prayer, with an optional offset. On a recurring item it limits the item to its days and time window (e.g. Kahf: Fridays, after Zuhr until Asr). | MUST | 4 | S16 |
| SCH-04 | Time anchor and user-defined **day parts** | SHOULD | 4 | S7 |
| SCH-05 | **Pending:** a task with no date lives in a Pending list | MUST | 2 | S19 |
| SCH-06 | Items can be planned for **tomorrow or any future date at any time**, e.g. the night before | MUST | 2 | S7, S19 |

### FLX — Flexible days

| ID | Requirement | Pri | Phase | From |
|----|-------------|-----|-------|------|
| FLX-01 | **Skip** today's occurrence. It is excluded from the %. | MUST | 2 | S12 |
| FLX-02 | **Move** to tomorrow or a picked date. One-offs move; for a repeating item only that day's instance moves. | MUST | 2 | S19 |
| FLX-03 | **Mark pending:** remove the date and send the item to the Pending list | MUST | 2 | S19 |
| FLX-04 | **Progress rule:** % = done ÷ required. Required excludes optional, skipped, moved, and pending. If nothing is required, the day is 100%. | MUST | 2 | S12 |
| FLX-05 | Categories and plans with nothing upcoming produce no warnings and no penalties | MUST | 2 | S13 |
| FLX-06 | A required occurrence left open at day end is recorded as **missed** for history and streaks only. It never blocks the next day. | MUST | 7 | S12, S18 |

### PRY — Spiritual and prayer

| ID | Requirement | Pri | Phase | From |
|----|-------------|-----|-------|------|
| PRY-01 | The prayer set is editable: rename, add (Tahajjud, Jumu'ah, Duha…), remove, and reorder. Default is the five prayers. | MUST | 4 | S14 |
| PRY-02 | The prayer block's placement is editable: its position on Today and in Spiritual, or another category | MUST | 4 | S14 |
| PRY-03 | A **ring** shows the day's prayers, and **one tap** marks each prayer prayed. Long-press (or the visible ⋯) opens Missed, Qada, and Undo. A prayer not prayed today can simply be left **unmarked**. | MUST | 4 | S14, A-2 |
| PRY-04 | **Any order:** no prayer blocks another. Past prayers can be marked later. | MUST | 4 | S15 |
| PRY-08 | **Day end → missed:** a prayer still unmarked when the user's day ends is recorded as **missed**. | MUST | 4 | A-2 |
| PRY-09 | **Qada recovery:** from history, the user can mark any past missed prayer as **prayed (qada)**. It then counts in prayed totals with a qada mark, so old missed prayers can be recovered. On-time streaks count only on-time prayers. | MUST | 4 | A-2 |
| PRY-10 | **Prayer-time defaults** are the Karachi method (University of Islamic Sciences) with Hanafi Asr, computed for the user's location. Each prayer has a per-minute offset to match the local mosque. Setup is in [PRAYER_TIMES.md](../guides/PRAYER_TIMES.md). | MUST | 4 | A-1 |
| PRY-05 | Prayer times come from location, calculation method, and madhab (adhan-js), or are typed in manually. Prayer times work offline. | MUST | 4 | S16 |
| PRY-06 | Quran and surah items use day and prayer anchors, e.g. Kahf on Friday after Zuhr, Mulk after Isha | MUST | 4 | S16 |
| PRY-07 | Prayer insights: totals per week and month, rate per prayer, **most missed**, **most consistent**, and a plain-language suggestion | MUST | 4 | S18 |

### PLN — Plans (content, university, work)

| ID | Requirement | Pri | Phase | From |
|----|-------------|-----|-------|------|
| PLN-01 | A plan has **dated steps**. Example: Collab at *Restaurant* has Shoot (date), Edit (date), Payment cleared, and Post (date). | MUST | 5 | S10 |
| PLN-02 | **Dependencies:** a step can wait on another, e.g. Post waits for Payment. A locked step shows why. | MUST | 5 | S10 |
| PLN-03 | Plan fields: venue or place, contact, and notes. Each step can have its own reminder. | MUST | 5 | S10 |
| PLN-04 | **Cadence rules** per category or plan: minimum gap days between steps of a kind, and allowed weekdays for shoot, edit, or post. The date picker warns and suggests; it never blocks. | SHOULD | 5 | S13 |
| PLN-05 | **University preset:** assignment, quiz, presentation, teacher meeting, FYP task or meeting, each with course and due date and time | MUST | 5 | S11 |
| PLN-06 | Plan steps appear on Today on their dates, like any other occurrence | MUST | 5 | S10 |

### REM — Reminders

| ID | Requirement | Pri | Phase | From |
|----|-------------|-----|-------|------|
| REM-01 | Per-item reminders: at a time, an offset before due, or relative to a prayer | MUST | 6 | S6 |
| REM-02 | Priority defaults (editable): low = none; medium = one; high = one plus a 30-min follow-up; **critical = repeat every N min until done** (max repeats, respects quiet hours) | MUST | 6 | S5 |
| REM-03 | Notification actions: **Done** and **Snooze** | MUST | 6 | S6 |
| REM-04 | Quiet hours, a global switch, and per-category mute | MUST | 6 | S6 |
| REM-05 | Delivery is Web Push now, with an iOS install prompt. **Exact alarms** come in the native wrap. | MUST | 6 / 11 | S6 |
| REM-06 | Optional "Plan tomorrow" evening nudge and morning summary | SHOULD | 6 | S7 |

### HIS — History and insights

| ID | Requirement | Pri | Phase | From |
|----|-------------|-----|-------|------|
| HIS-01 | Item history: month heatmap, 7-day bars, completion rate, current and best streak, and a log list with values | MUST | 3 (basic) / 7 | S9, S18 |
| HIS-02 | Week and month summaries per category and overall | MUST | 7 | S18 |
| HIS-03 | "Needs improvement / doing well" insight per category, generalising PRY-07 | SHOULD | 7 | S18 |
| HIS-04 | Past days can be edited (backfill). Late completions do not earn points after 48 h. | MUST | 7 | S18 |

### REW — Motivation

| ID | Requirement | Pri | Phase | From |
|----|-------------|-----|-------|------|
| REW-01 | Points per completion, weighted by priority (1 / 2 / 3 / 5), plus a perfect-day bonus. Computed on the server only. | MUST | 8 | S8 |
| REW-02 | Streaks per habit and per day. **Freezes:** earn 1 per 7-day streak, hold at most 2. A broken streak shows a gentle restart, never shaming. | MUST | 8 | S8 |
| REW-03 | Badges at milestones: 3, 7, 30, and 100 days; all prayers for a week; first plan finished; perfect week | MUST | 8 | S8 |
| REW-04 | A small celebration on completing an item, the day, or a badge (respects reduced motion) | SHOULD | 8 | S8 |

### SOC, CHL, SHR — Social, challenges, sharing

| ID | Requirement | Pri | Phase | From |
|----|-------------|-----|-------|------|
| SOC-01 | Friends: invite by link or email, accept, remove, block | MUST | 9 | S20 |
| SOC-02 | Groups: create, invite registered friends, or use an invite link that leads to sign-up and then joining | MUST | 9 | S20 |
| SOC-03 | **Group goals and tasks** with a period. Each member logs from their own Today. Completers and the group earn points. | MUST | 9 | S20 |
| SOC-04 | **Leaderboards, in this order:** (1) friends and groups; (2) a local friends leaderboard and a **global** all-users leaderboard. Group vs group uses average points per member. Weekly and monthly, with rewards for the top. | MUST | 9 | S21, A-3 |
| SOC-05 | Privacy: others see only points, group-goal progress, and what was shared | MUST | 9 | C12 |
| SOC-06 | **Visibility setting:** each user chooses who sees their achievements and task progress (Only me / Friends / Everyone). It is honoured by leaderboards, profiles, and shares. Users who choose "Only me" stay off the global board. | MUST | 9 | A-3 |
| CHL-01 | **Platform challenges**, weekly or monthly. Users join and complete them in time to earn points and a badge. | MUST | 10 | S22 |
| CHL-02 | A minimal admin screen to create, schedule, and close challenges | MUST | 10 | S22 |
| SHR-01 | **Share a streak or achievement** with friends in the app; friends can send kudos | MUST | 9 | S23 |
| SHR-02 | Share as an image outside the app | SHOULD | 11 | S23 |

### UI — Interface

| ID | Requirement | Pri | Phase | From |
|----|-------------|-----|-------|------|
| UI-01 | Simple interface per `UI Images/`: light lavender-grey background, white rounded cards, pastel status colors, **Poppins**, few labels, no decoration for its own sake | MUST | 0 / 2 | S1 |
| UI-02 | Bottom nav: Today · Categories · **+** · Progress · Profile | MUST | 2 | S2, S3 |
| UI-03 | Mobile-first (430 px design width). Touch targets of at least 44 px. WCAG AA text contrast. | MUST | all | — |
| UI-04 | Dark mode with derived tokens, reviewed by the owner | SHOULD | 2 | — |

### Kept from Addendum A

- **ACC-01…03** (accounts, isolation, per-user offline cache): **Phase 1**.
- **CUS-01…04:** merged into CAT/ITM above.
- **LIB-01…05:** **Phase 12**. Provenance columns exist from Phase 1.

### Non-functional

| ID | Requirement |
|----|-------------|
| NFR-01 | **Offline-first.** Every write lands locally first and syncs later. Today renders from local data in under 1 s on a mid-range phone. |
| NFR-02 | **Privacy:** all user data is scoped by `user_id` on every query. Sync rejects rows the caller doesn't own (fixes BUG-002). |
| NFR-03 | **Time:** dates are the user's local `YYYY-MM-DD`; instants are UTC. Each user has an IANA timezone. |
| NFR-04 | **Integrity:** points, badges, and leaderboards are computed only on the server, idempotently (unique source per ledger row). |
| NFR-05 | **Storage:** the local DB persists to IndexedDB, which removes the 5 MB localStorage cap. |
| NFR-06 | **Accessibility:** AA contrast, focus states, labels on icon buttons, and reduced-motion support. |

---

## 6. Migration of existing data (Phase 1)

| Old (`habit_definitions` slug → logs) | New |
|------|-----|
| category values (`faith`, `health`, `personal`…) | One **category** per distinct value per user (Faith → "Spiritual") |
| `prayer` + payload `{prayers: {fajr: completed\|missed\|pending …}}` | Group item "Daily prayers" with 5 child items. Each day → 5 occurrences (`completed`→done, `missed`→missed, `pending`→no row). |
| `quran-mulk`, `quran-kahf` | Habits; Kahf gets weekdays [Fri] and an after-Zuhr anchor; Mulk gets an after-Isha anchor |
| `steps`, `water` (counter payload) | Quantity habits (step 500 / 1); value copied; target from `config.goal` |
| `exercise` | Duration habit; `detail.type` keeps the exercise type |
| `sleep` (`bedAt`, `wakeAt`) | Duration habit; value = minutes; `detail` keeps `bedAt` and `wakeAt` |
| `make-bed`, `no-phone-hour`, custom boolean habits | Check habits |

The migration is a script plus a test with fixture logs. Old tables are kept read-only for one release, then dropped.

---

## 7. Requirements by phase

| Phase | Requirements |
|-------|--------------|
| 0 Docs and design system | UI-01 (tokens and UI kit) |
| 1 Foundation v2 | ACC-01…03, NFR-01…05, §6 migration |
| 2 Today | TOD-01…05, CAT-04, ITM-04, TRK-01, TRK-05, SCH-01, SCH-05, SCH-06, FLX-01…05, UI-02, UI-04 |
| 3 Categories and items | CAT-01…03, CAT-05, ITM-01…03, ITM-05…07, TRK-02…04, SCH-02, HIS-01 (basic) |
| 4 Spiritual | PRY-01…10, SCH-03, SCH-04, TOD-06, TOD-07 |
| 5 Plans | PLN-01…06 |
| 6 Reminders | REM-01…06 (REM-05 web part) |
| 7 History and analytics | HIS-01…04, FLX-06 |
| 8 Motivation | REW-01…04 |
| 9 Social | SOC-01…06, SHR-01 |
| 10 Platform challenges | CHL-01…02 |
| 11 Native wrap | REM-05 (alarms), SHR-02 |
| 12 Template library | LIB-01…05 |

## 8. Traceability check

Every owner statement S1–S23 maps to at least one ID:

| Statement | IDs |
|-----------|-----|
| S1 | UI-01 |
| S2 | TOD-01, TOD-02, TRK-05 |
| S3 | CAT-01, CAT-02 |
| S4 | ITM-01, ITM-02, TRK-01, TRK-03, TRK-04 |
| S5 | ITM-03, REM-02 |
| S6 | REM-01, REM-03, REM-04, REM-05 |
| S7 | TOD-04, TOD-06, SCH-04, SCH-06 |
| S8 | REW-01…04 |
| S9 | CAT-03, ITM-07, HIS-01 |
| S10 | PLN-01…03, PLN-06 |
| S11 | PLN-05 |
| S12 | FLX-01, FLX-04, ITM-04 |
| S13 | CAT-04, FLX-05, PLN-04 |
| S14 | PRY-01…03, CAT-05, TOD-07 |
| S15 | PRY-04, PRY-08, PRY-09 |
| S16 | SCH-03, PRY-05, PRY-06 |
| S17 | TRK-02, TOD-05 |
| S18 | HIS-01…03, PRY-07 |
| S19 | SCH-05, SCH-06, FLX-02, FLX-03 |
| S20 | SOC-01…03 |
| S21 | SOC-04, SOC-06 |
| S22 | CHL-01, CHL-02 |
| S23 | SHR-01, SHR-02 |
