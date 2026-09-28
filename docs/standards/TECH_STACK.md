# Tech stack

**Status:** Locked **2026-09-27** (see [DECISION.md](../../DECISION.md))

## Product

- **Personal Life Management PWA** — mobile-first, installable, offline-capable (SQLite local + cloud sync)

## Stack

| Layer | Choice | Notes |
|-------|--------|--------|
| Backend runtime | **Node.js 20+** | `apps/api` |
| Backend language | **TypeScript** (strict) | |
| HTTP framework | **Fastify** | Lightweight API for sync & CRUD |
| Frontend | **Next.js** (App Router) + **TypeScript** | `apps/web` |
| Styling | **Tailwind CSS v4** | Feminine soft theme in `tailwind` config |
| Cloud DB | **PostgreSQL** | Docker locally; managed Postgres in prod |
| Offline DB | **SQLite** | Browser: wa-sqlite + OPFS (Phase 02); same logical schema |
| ORM / migrations | **Drizzle ORM** | Postgres + better-sqlite3 (API/tests); client SQLite adapter in web |
| Validation | **Zod** | Shared in `packages/shared` |
| PWA | **Serwist** (`@serwist/next`) | Service worker + precache |
| Charts (later) | **Recharts** | Phase 11 |
| Monorepo | **npm workspaces** | `apps/*`, `packages/*` |

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection (API) |
| `NEXT_PUBLIC_API_URL` | Web → API base URL |
| `PORT` | API port (default 4000) |

## Scripts (root)

- `npm run dev` — web + api
- `npm run build` — all workspaces
- `npm run lint` — eslint across apps
