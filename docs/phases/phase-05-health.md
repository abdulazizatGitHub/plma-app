# Phase 05 — Steps, Water, Exercise & Sleep

## Goal

CRD §4–7: steps (default 10k, editable goal, progress %), water (8 glasses, tap add), exercise (done/duration/type), sleep (bed/wake/duration, 6 AM wake goal, averages, consistency).

## Requirements

- FR-05-01: Steps goal configurable; auto-complete at target.
- FR-05-02: Water glass-by-glass increment; weekly/monthly stats.
- FR-05-03: Exercise log with optional duration/type; weekly/monthly consistency.
- FR-05-04: Sleep times → duration; wake goal indicator; week/month aggregates.
- FR-05-05: **Deferred optional:** Health Connect / device step import (Phase 13).

## Acceptance criteria

- [x] Manual steps entry matches CRD examples — exact total entry (validated 0–200,000) plus +500/+1k/+2k quick add; tile auto-completes at goal
- [x] Water 6/8 display — headline `6/8`, eight tappable glasses (six filled), glass-by-glass −/+
- [x] Sleep averages on progress views (Phase 11 may aggregate) — `/health` shows week/month average sleep, average wake-up, nights up by the wake goal, and wake-time consistency; the Progress tab will reuse `summarizeSleep` in Phase 11

## Implementation

| Area | Where |
|------|-------|
| Payload schemas, clock/duration helpers, Monday-start periods, week/month summaries | `packages/shared/src/health-tracking.ts` (+ tests) |
| Editable goals (definition `config`, synced through the existing definition push) | `updateLocalDefinitionConfig` in `apps/web/src/lib/sync/sync-engine.ts` |
| Sleep row + exercise details on the Home dashboard; sleep counts toward completion | `apps/web/src/lib/dashboard/today-summary.ts` |
| Health screen: Steps / Water / Exercise / Sleep cards, Week–Month toggle, goal editors, last-7-days bars | `apps/web/src/components/health/*`, route `/health` |
| Home: Sleep tile, "Details ›" links to `/health#<section>`, Up Next routes to sleep logging | `apps/web/src/components/home/today-dashboard.tsx` |

## Payloads (`habit_logs.payload`)

| Habit (slug) | Payload | Notes |
|--------------|---------|-------|
| `steps`, `water` | `{ value: int ≥ 0 }` | Goal in definition `config.goal` (defaults 10,000 / 8) |
| `exercise` | `{ completed: bool, durationMinutes?: 1–1440, type?: walk\|run\|gym\|yoga\|cycling\|swim\|sport\|other }` | Home quick toggle preserves duration/type |
| `sleep` | `{ bedAt: ISO UTC, wakeAt: ISO UTC }` | Logged on the **wake-up** date; ≤ 24h; wake goal in `config.wakeGoal` (`HH:MM`, default `06:00`) |

## Out of scope / follow-ups

- Logging or editing past days (e.g. a missed night) — Calendar day detail, Phase 10
- Health Connect / device step import — FR-05-05, Phase 13
