# Mehrmah: web app

The Next.js PWA in the Mehrmah monorepo. See the [root README](../../README.md) for setup, commands and deploys.

- Run from the repo root: `npm run dev:web` (or `npm run dev` for web and API together).
- Env values come from the repo-root `.env.local` (`next.config.ts` reads it).
- On Vercel, Root Directory is `apps/web`. [`vercel.json`](./vercel.json) installs the whole workspace from the root lockfile.
- The in-app guide lives in `src/lib/help/content.ts`. After editing it, run `npm run docs:guide -w web`.
