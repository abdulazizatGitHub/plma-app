# Personal Life Management & Tracking — Client Requirements

Source document captured **2026-09-27**. Phase specs in `docs/phases/` decompose this into deliverables.

## Summary

Personal life-management PWA: daily habits, religious practice, health, sleep, reading, university, tasks, weekly/monthly goals, content creation, calendar, analytics. UI: clean, feminine, modern, minimal daily friction. Data must be historical and **habits/goals configurable in-app** without redeploy.

## Navigation (target)

1. Home · 2. Goals · 3. Calendar · 4. Progress · 5. More/Settings (+ Content under Goals or More)

## Feature index → Phase mapping

| CRD § | Topic | Phase |
|-------|--------|-------|
| 2 | Prayer tracking + stats | 04 |
| 3 | Quran (Mulk nightly, Kahf Friday) | 04 |
| 4 | Steps (10k goal, optional health sync) | 05 |
| 5 | Water (8 glasses) | 05 |
| 6 | Exercise | 05 |
| 7 | Sleep (6 AM wake goal) | 05 |
| 8 | Book reading | 06 |
| 9 | University / academic | 06 |
| 10 | Make bed, no phone, plan tomorrow | 07 |
| 11 | Daily tasks + reminders | 08 |
| 12 | Weekly goals | 08 |
| 13 | Monthly goals (e.g. savings) | 08 |
| 14–15 | Content creation + analytics | 09 |
| 16 | Calendar day detail | 10 |
| 17 | Progress & analytics dashboard | 11 |
| 18 | Home / daily dashboard | 03 (+ ongoing) |
| 19 | Reminders & notifications | 12 |
| 20 | Custom habits | 06 |
| 21 | Quick add | 12 |
| 22 | UI/UX design | 01 + all |
| 23–24 | Storage, history, extensibility | 02 + all |
| 25–26 | Navigation, overall objective | 03, 11 |
| A1 | Multi-user accounts & data isolation | 06A |
| A2 | Customization: templates, own habits/goals/targets | 06B |
| A3 | Public template library (share, star, adopt) | 14 |

## Addendum A — Accounts, customization, template library (2026-09-30)

Owner direction, recorded verbatim in intent. **Supersedes** the original "personal app for one owner" assumption (see DECISION.md).

### A1 — Multiple people, each with their own account

- **ACC-01** Anyone can sign up, sign in, sign out, and reset their password.
- **ACC-02** Every user's habits, goals, logs, and templates are private to them. No user can read or write another user's data, including by guessing ids.
- **ACC-03** The app stays offline-first per user. A signed-in user's data is cached on their device, and signing out removes it from that device.

### A2 — Everything is customized per user; nothing is the same for everyone

- **CUS-01** A new user starts **empty**. They choose from a **template gallery** (e.g. prayer, water, sleep), create their own habits, or both. Nobody gets habits they didn't choose.
- **CUS-02** Users define their own **habits, goals, and targets**: name, how it's tracked (check, count with a target, duration, time window, …), schedule, and target values.
- **CUS-03** Users can **define their own templates**, i.e. a named bundle of habits, goals, and targets they can reuse.
- **CUS-04** The Home screen and every detail page are driven by **that user's own** habits and goals. Users can edit, archive, and reorder anything they own.

### A3 — Public template library (later phase; rules recorded now)

- **LIB-01** A user may make one of **their own** templates **public**.
- **LIB-02** Other users can browse public templates, **use** (adopt) them, and **star** them; popular templates surface first, like a repository.
- **LIB-03** When a user adopts a template, they may add **their own extra** goals, habits, and tasks **alongside** it. The adopted template's own items stay as published.
- **LIB-04** A user who adopted someone else's template **cannot** add items to that template and publish it as their own template. This counts as cheating and must be prevented.
- **LIB-05** Provenance is **recorded** for everything that came from a template: the source template, its author, the version adopted, and when. This is recorded from the moment templates exist (Phase 06B), not only once the library ships, so that LIB-04 can be enforced retroactively.
