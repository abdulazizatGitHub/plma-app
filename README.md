# Life — Personal Life Management PWA

Monorepo for a personal tracking PWA (habits, prayer, health, goals, content).

## Docs

Start at [AGENT.md](./AGENT.md) for phase plan, decisions, and progress.

## Prerequisites

- Node.js 20+
- Docker (optional, for Postgres in Phase 02+)

## Setup

```bash
npm install
cp .env.example .env
cp apps/web/.env.local.example apps/web/.env.local
```

## Development

```bash
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/health

## Database (Phase 02+)

**Required:** PostgreSQL connection in `apps/api/.env` as `DATABASE_URL`.

Full instructions (Docker, local, or cloud): **[docs/DATABASE_SETUP.md](./docs/DATABASE_SETUP.md)**

Quick check after API is running:

```bash
curl http://localhost:4000/health/db
```

## Build

```bash
npm run build
```

PWA service worker is enabled in production builds (`public/sw.js` via Serwist).
