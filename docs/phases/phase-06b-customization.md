# Phase 06B — Customization: Templates, Own Habits, Goals & Targets

## Goal

Addendum A2 (CUS-01…04): every user builds their own tracker. Home and detail pages are driven by the user's habits, not a hardcoded list.

## Scope

- **Template gallery:** system templates (today's 9 seeds, plus reading and study from the original Phase 06) become a **catalog to pick from**, not something auto-added.
- **Onboarding:** a new user with no habits picks templates and/or creates their own.
- **Habit manager:**
  - create, edit, archive, restore, and reorder
  - name, icon, and color
  - tracking method: check · count with target and unit · duration · time window · prayer set
  - schedule: daily · specific weekdays · weekly · Fridays
  - targets
- **Own templates:** save a named bundle of your habits and targets as a reusable private template.
- **Home:** renders the user's active habits in their order and groups. Tiles are picked by tracking method; prayer, Quran, and health keep their specialized tiles.
- **Generic detail page** `/habits/[id]` for any habit: ring, history, week/month stats, and target editing. Prayer and Health keep their dedicated pages.
- **Provenance (LIB-05 groundwork):** habits record `source_template_id`, `source_template_version`, and `adopted_at` when created from a template.

## Data model changes (planned)

- `habit_definitions`: `sort_order`, `icon`, `color`, `schedule`, `source_template_id`, `source_template_version`, `adopted_at`
- `templates`: `owner_user_id` (null = system), `name`, `items` (habit specs + targets), `version`, `visibility` (`private` now; `public` in Phase 14)

## Acceptance criteria

- [ ] New user picks "Prayer" and "Water" from the gallery; only those appear on Home
- [ ] Create a custom counted habit (e.g. "Pages read", target 20) and log it from Home
- [ ] Edit, archive, and reorder habits; Home reflects the change
- [ ] Save own habits as a private template and apply it again
- [ ] Habits created from a template carry provenance fields

## Absorbs original Phase 06

Reading and University become templates here, using the same engine rather than one-off screens. Book library and academic-task specifics follow as template-specific detail views.
