# v2 Phase 1 — Foundation v2

**Release:** R1 · **Requirements:** ACC-01…03, NFR-01…05, migration ([REQUIREMENTS_V2 §6](../../requirements/REQUIREMENTS_V2.md#6-migration-of-existing-data-phase-1)) · **Depends on:** 0

## Goal

Multi-user accounts on the new data model, with the owner's existing history carried over.

## Scope

- **Auth:**
  - Supabase Auth: email and password, password reset, Google optional (PRD §12 Q4)
  - Web sign-in, sign-up, and reset screens, with a route guard
  - API verifies the JWT via JWKS
  - Remove `ensureDefaultUser` and `SYNC_API_KEY`
- **Schema:** a Drizzle migration for the core tables in [SYSTEM_DESIGN §4](../../architecture/SYSTEM_DESIGN.md#4-data-model):
  - `users`, `user_settings`, `devices`
  - `categories`, `items`, `item_dependencies`, `cadence_rules`
  - `occurrences`, `reminders`, `templates`
  - provenance columns
- **Shared Zod:** `Tracking`, `Schedule`, `Anchor`, `Trigger`, and the entity schemas in `packages/shared`.
- **Sync:**
  - entity-agnostic outbox and pull
  - ownership checks on every referenced id (fixes BUG-002)
  - last-write-wins by `updated_at`
  - soft deletes
- **Local store:**
  - one SQLite DB per user, persisted to IndexedDB
  - wiped on sign-out
  - a cached session opens offline
- **Migration script:** old `habit_definitions` / `habit_logs` → categories, items, and occurrences. The owner's first sign-up claims the old Owner data.
- **Ops:** fix B-001. Either make `db:migrate:manual` the documented default on Windows, or patch drizzle-kit.

## Acceptance

- [x] Two accounts on one device see completely separate data. A crafted push with a foreign id is rejected.
  - Unit coverage: `sync/sync.test.ts` and `lib/v2/v2-store.test.ts`.
  - Live check on 2026-10-09 against Supabase with two real accounts, 11/11 passed:
    - a foreign reference is rejected (422)
    - reusing another account's id is rejected (409)
    - pushing rows that claim another user is rejected (403)
    - stale edits are ignored
- [~] Sign-out wipes local data; a previously signed-in session opens offline.
  - Wipe: browser E2E passed 9/9. It found and fixed a bug where an open store wrote itself back after the wipe.
  - Session offline: the Supabase session is read from local storage with no network call.
  - Full offline app launch still needs the production service worker, which is disabled in dev. Check this in Phase 2.
- [x] A new account starts with zero categories, and gets default settings (Karachi, Hanafi, friends visibility). Verified live.
- [~] After migration, the monthly prayer report and the steps, water, and sleep summaries give the same numbers on the new tables.
  - Fixture test: prayer done/missed totals and step totals match v1. Sleep minutes and bed/wake times are carried over.
  - Still open: running it on the owner's real data. That waits for the owner's sign-up, then `npm run db:migrate:v1 -w @life/api -- --email … [--apply]`.
- [x] The local DB survives more than 5 MB of data (IndexedDB). Covered by `lib/v2/v2-store.test.ts`.
