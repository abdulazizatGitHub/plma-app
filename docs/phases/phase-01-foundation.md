# Phase 01 — Foundation, PWA & Design System

## Goal

Establish monorepo, Next.js PWA shell, Node/TypeScript API skeleton, Tailwind feminine design tokens, and dev tooling so later phases can ship features incrementally.

## Acceptance criteria

- [x] `npm install` at root succeeds
- [x] `npm run dev` runs web + api concurrently
- [x] Home shows branded shell with bottom nav (stub routes)
- [x] PWA manifest + service worker on production build (`/sw.js`)
- [x] `GET /health` on API returns 200
- [x] Design tokens in `apps/web/src/app/globals.css` (`@theme inline`)

## Tasks

| ID | Task | Status |
|----|------|--------|
| T-01-01 | Monorepo + workspaces | Done |
| T-01-02 | Next.js app + Tailwind theme | Done |
| T-01-03 | PWA manifest + Serwist | Done |
| T-01-04 | API skeleton + health route | Done |
| T-01-05 | Shared package scaffold | Done |
| T-01-06 | Docker Compose Postgres | Done |
| T-01-07 | Base UI components + layout | Done |

## Notes

- SVG icon in manifest; add 192/512 PNG in Phase 13 for stricter Lighthouse installability.
