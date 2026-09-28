# Database standards

## Engines

| Store | Use |
|-------|-----|
| **PostgreSQL** | Source of truth when online; API persistence |
| **SQLite** | Offline client store (PWA); sync to Postgres |

## ORM & migrations

- **Drizzle ORM** with SQL migration files in `apps/api/drizzle/`
- Never edit applied migrations; add new migration for changes
- Client SQLite schema must stay compatible with sync payload (document drift in DECISION)

## Naming

- Tables: plural `snake_case` (`habit_definitions`, `prayer_logs`)
- PK: `id` UUID text
- FK: `<entity>_id`
- Timestamps: `created_at`, `updated_at` (timestamptz UTC on Postgres)

## Core modeling (Life app)

- **habit_definitions** — configurable habits (system + user); CRD §24
- **daily_logs** / domain tables — typed logs per day (prayer, water, etc.) linked to definitions where applicable
- **sync_metadata** — cursor, last_sync_at, device_id (client + server)

## Sync rules

- Offline writes append to local queue with `updated_at` + `device_id`
- **Conflict:** last-write-wins on `updated_at`; server merges by row id
- Deletes: soft-delete `deleted_at` for sync propagation

## Security

- Single-user v1: API token or session; no shared DB credentials in client
- Postgres role: least privilege for app user

## Seeds

- Predefined habit templates seeded via migration or idempotent seed script (prayers, default water goal, etc.)
