# Project issues — blockers & bugs

Track **blockers**, **bugs**, and **significant incidents** here. Lightweight notes are fine; link to commits or phase docs when relevant.

## Status legend

| Status | Meaning |
|--------|---------|
| `open` | Not fixed / not unblocked |
| `investigating` | Root cause or scope unclear |
| `fixed` | Resolved in codebase or process |
| `wontfix` | Accepted limitation or out of scope |

## Blockers

_Blockers prevent phase or release progress._

| ID | Opened | Status | Phase | Summary | Resolution |
|----|--------|--------|-------|---------|------------|
| B-001 | 2026-09-27 | fixed | 02 | `drizzle-kit migrate` exits 1 on Windows without clear error | Fixed 2026-10-09: `npm run db:migrate:manual -w @life/api` now applies every pending journal entry, one transaction each, and reports RLS status per table. Use it instead of `db:migrate`. |
| B-002 | 2026-09-27 | fixed | 02 | Postgres connectivity | Resolved with Supabase **session pooler** URL in `apps/api/.env` |

## Bugs

| ID | Opened | Status | Severity | Summary | Steps / notes | Fix reference |
|----|--------|--------|----------|---------|---------------|---------------|
| BUG-003 | 2026-10-09 | fixed | critical | App tables were readable/writable with the public Supabase anon key | Row Level Security was off, so Supabase's auto REST API exposed `habit_logs`, `users`, and the other tables to anyone holding the browser key. Fix: migration `0001_v2_core` enables RLS on every public table. The API connects as the table owner and is unaffected. Verified 2026-10-09: the anon key sees 0 rows. | `apps/api/drizzle/0001_v2_core.sql` |
| BUG-004 | 2026-10-09 | fixed | major | Sign-out left the v2 offline store on the device | The store provider's cleanup flushed the still-open store after the wipe, recreating the file. Fix: `wipeUserStore` discards open stores first. Found by browser E2E; regression test in `lib/v2/v2-store.test.ts`. | `apps/web/src/lib/v2/local-store.ts` |
| BUG-002 | 2026-09-30 | fixed | critical (once multi-user) | Sync push doesn't verify ownership of `habitDefinitionId` / definition `id` | `POST /v1/sync/push` upserts logs and definitions by client-supplied ids without checking they belong to the caller. Harmless with one Owner. With accounts it lets one user write into another's habits. | Fixed 2026-10-09 (v2 Phase 1): old v1 routes removed; `/v1/sync/push` (`apps/api/src/sync/plan.ts`) checks every reference and id owner before writing, and upserts only update rows where `user_id` = caller. Covered by unit tests plus a live two-account check. |
| BUG-001 | 2026-09-28 | fixed | major | Home dashboard hangs forever on "Loading habits…" | `postinstall` only copied `dist/sql-wasm.wasm`; webpack resolves sql.js's `browser` export to `sql-wasm-browser.js`, which fetches `sql-wasm-browser.wasm` (never present in `public/`) → 404 → WASM loader hangs silently, `getLocalDb()` never resolves | apps/web/package.json postinstall, commit ba755e4 |

**Severity:** `critical` (data loss / security / unusable) · `major` · `minor` · `trivial`

## Incident log (optional narrative)

_Use for multi-step investigations or production-like issues._

---

_No incidents recorded._
