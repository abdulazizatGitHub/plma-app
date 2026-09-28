# Coding standards

## Repository layout

```
apps/
  web/          # Next.js PWA UI
  api/          # Node Fastify API
packages/
  shared/       # Zod schemas, types, constants
docs/           # Phases, standards, requirements
```

## TypeScript

- `strict: true` in all `tsconfig.json`
- Prefer `interface` for public object shapes; Zod for runtime validation at API boundaries
- No `any` without comment + DECISION if widespread

## Naming

- Files: kebab-case (`habit-log.ts`, `prayer-card.tsx`)
- React components: PascalCase
- DB columns: `snake_case`
- API routes: REST plural nouns (`/habits`, `/daily-logs`)

## React / Next.js

- App Router; server components by default, `"use client"` only when needed
- Co-locate feature UI under `apps/web/src/features/<domain>/`
- Shared UI in `apps/web/src/components/ui/`

## API

- JSON only; errors `{ error: { code, message } }`
- Validate body/query with Zod from `@life/shared`
- Version prefix optional: `/v1/` when breaking changes

## Git

- Imperative commit messages; reference phase task IDs when useful (`T-01-03`)

## Testing

- Vitest for shared + API unit tests (introduce Phase 02+)
- Manual PWA checklist before phase sign-off

See also [IMPLEMENTATION.md](./IMPLEMENTATION.md), [DATABASE_STANDARDS.md](./DATABASE_STANDARDS.md).
