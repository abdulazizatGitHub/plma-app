# Database setup (Postgres)

Phase 02 needs a **PostgreSQL** database the API can reach from your machine. Cloud sync and habit APIs do not work until `DATABASE_URL` is valid and migrations are applied.

## What you need to provide

Create **`apps/api/.env`** (copy from repo root `.env.example`) with at least:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
PORT=4000
CORS_ORIGIN=http://localhost:3000
```

Optional later:

```env
SYNC_API_KEY=your-secret-if-you-want-api-key-auth
DEFAULT_USER_ID=
```

Also create **`apps/web/.env.local`**:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

After you fill these in, tell the agent (or run yourself):

```bash
cd apps/api
npm run db:migrate
npm run dev
```

Then open **More → Data & sync** in the app and tap **Sync now**, or call:

- `GET http://localhost:4000/health/db` — should return `"database": "connected"`
- `GET http://localhost:4000/v1/sync/pull` — should return system habit templates

---

## Option A — Docker (recommended if ports are free)

From repo root:

```bash
docker compose up -d
```

Default in `docker-compose.yml`:

| Setting | Value |
|---------|--------|
| Host port | **5434** → container 5432 |
| User | `life` |
| Password | `life_dev` |
| Database | `life` |

**`DATABASE_URL`:**

```env
DATABASE_URL=postgresql://life:<password>@127.0.0.1:5434/life  # docker-compose dev password: see docker-compose.yml
```

Apply schema (if `npm run db:migrate` fails on Windows):

```powershell
Get-Content apps/api/drizzle/0000_*.sql -Raw | docker exec -i app-postgres-1 psql -U life -d life
```

**If connection fails:** another service may be bound to 5434. Change the host port in `docker-compose.yml` (e.g. `"5435:5432"`) and update `DATABASE_URL` to match.

---

## Option B — Local PostgreSQL (already installed)

1. Create a database and user, e.g.:

```sql
CREATE USER life_app WITH PASSWORD 'choose_a_strong_password';
CREATE DATABASE life OWNER life_app;
GRANT ALL PRIVILEGES ON DATABASE life TO life_app;
```

2. Set:

```env
DATABASE_URL=postgresql://life_app:<the password you chose>@127.0.0.1:5432/life
```

3. Run migrations from `apps/api` (see above).

---

## Option C — Supabase (recommended for you)

### What to put where

| File | Variables | Purpose |
|------|-----------|---------|
| **`apps/api/.env`** | `DATABASE_URL` (required), `PORT`, `CORS_ORIGIN`, optional `SYNC_API_KEY` | API + Drizzle migrations |
| **`apps/web/.env.local`** | `NEXT_PUBLIC_API_URL=http://localhost:4000` | PWA talks to your local API (not Supabase URL) |

You do **not** need Supabase `anon` / `service_role` keys in `.env` for Phase 02 — the Fastify API connects with `DATABASE_URL` only. (We can add Supabase Auth later.)

### Where to get `DATABASE_URL` in Supabase

1. [Supabase Dashboard](https://supabase.com/dashboard) → your project  
2. **Project Settings** (gear) → **Database**  
3. Under **Connection string**, choose **URI**  
4. Prefer **Session pooler** (host `….pooler.supabase.com`, port **5432**) — works on Windows/IPv4 and for migrations. Use **Direct** only if Session is unavailable.  
5. Replace `[YOUR-PASSWORD]` with the database password you set when creating the project (or reset under **Database password** on the same page)  
6. Ensure the string ends with **`?sslmode=require`** (add it if missing)

Example shape (yours will differ):

```env
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxx:YOUR_PASSWORD@db.xxxxxxxxxxxx.supabase.co:5432/postgres?sslmode=require
```

**If you see `ENOTFOUND` or connection errors on Windows:** Supabase **Direct** host is often **IPv6-only**. Use **Session pooler** (same Database page → Connection pooling → URI, mode **Session**, port **5432**) as `DATABASE_URL` instead, still with `?sslmode=require`.

**Avoid for migrations:** “Transaction” pooler (port **6543**) when Session or Direct works.

### After you save `apps/api/.env`

Tell the agent “Supabase `.env` is set” (do **not** paste the password in chat). The agent will run:

```bash
cd apps/api
npm run db:migrate
node scripts/pg-smoke.mjs
```

Then start the stack with `npm run dev` and check `http://localhost:4000/health/db`.

### Optional Supabase keys (not required now)

For future Auth / Storage / Realtime in the web app you might add later to `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Phase 02 does **not** use these yet.

---

## Option D — Other hosted Postgres (Neon, Railway, etc.)

1. Copy the **connection string** (with `?sslmode=require` if needed).
2. Paste into `apps/api/.env` as `DATABASE_URL`.
3. Run `npm run db:migrate` from `apps/api`.

---

## Verify connectivity

```bash
cd apps/api
node scripts/pg-smoke.mjs
```

Or with API running:

```bash
curl http://localhost:4000/health/db
```

Expected when OK:

```json
{ "status": "ok", "database": "connected", "timestamp": "..." }
```

---

## Migrations

| Command | Purpose |
|---------|---------|
| `npm run db:generate -w @life/api` | New migration after schema changes |
| `npm run db:migrate -w @life/api` | Apply migrations |

SQL files live in `apps/api/drizzle/`.

---

## Agent handoff

When your database is ready, send:

1. Confirmation that `GET /health/db` returns **connected** (you can paste the JSON).
2. Whether you used Docker, local, or cloud (no need to send the password in chat — only confirm `.env` is set locally).

The agent will run migrations if needed, seed system habits, and finish Phase 02 acceptance checks.
