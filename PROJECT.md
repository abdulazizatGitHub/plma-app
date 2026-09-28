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
| B-001 | 2026-09-27 | open | 02 | `drizzle-kit migrate` exits 1 on Windows without clear error | Apply SQL via `docs/DATABASE_SETUP.md` or fix drizzle-kit |
| B-002 | 2026-09-27 | fixed | 02 | Postgres connectivity | Resolved with Supabase **session pooler** URL in `apps/api/.env` |

## Bugs

| ID | Opened | Status | Severity | Summary | Steps / notes | Fix reference |
|----|--------|--------|----------|---------|---------------|---------------|
| BUG-001 | 2026-09-28 | fixed | major | Home dashboard hangs forever on "Loading habits…" | `postinstall` only copied `dist/sql-wasm.wasm`; webpack resolves sql.js's `browser` export to `sql-wasm-browser.js`, which fetches `sql-wasm-browser.wasm` (never present in `public/`) → 404 → WASM loader hangs silently, `getLocalDb()` never resolves | apps/web/package.json postinstall, commit ba755e4 |

**Severity:** `critical` (data loss / security / unusable) · `major` · `minor` · `trivial`

## Incident log (optional narrative)

_Use for multi-step investigations or production-like issues._

---

_No incidents recorded._
