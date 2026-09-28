# Phase 02 — Data Model, Postgres, SQLite Offline & Sync

## Status: **Done** (2026-09-27)

Supabase **session pooler** `DATABASE_URL` in `apps/api/.env`. Migrations applied via `npm run db:migrate:manual`. `/health/db` returns connected.

## Acceptance criteria

- [x] Migrations apply to Postgres
- [x] Local DB initializes on first PWA load
- [x] Sync pull returns system habit templates from Supabase
- [x] Habit definition CRUD without redeploy (API + More → custom habit)

## Tasks

| ID | Task | Status |
|----|------|--------|
| T-02-01 | Schema + DECISION entries | Done |
| T-02-02 | Postgres migrations | Done |
| T-02-03 | Local SQLite layer | Done |
| T-02-04 | Sync push/pull + queue | Done |
| T-02-05 | REST/sync API | Done |
| T-02-06 | Supabase `DATABASE_URL` | Done |
