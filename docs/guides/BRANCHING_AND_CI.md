# Branching, releases and quality checks

How code moves from a laptop to production, and what checks it passes on the way. This was decided by the owner on 2026-10-11.

## Branches

| Branch | Purpose | Deployed to |
|---|---|---|
| `main` | What real users run (production) | Live (when hosting is set up) |
| `preprod` | Exactly what will go live next, tested in a non-live environment | Pre-production |
| `dev` | Day-to-day integration of finished work | — (or a dev preview) |
| `feature/<name>`, `fix/<name>` | One change at a time; short-lived | — |
| `hotfix/<name>` | Urgent production fix, branched from `main` | — |

Changes only flow **forward**: `feature/*` → `dev` → `preprod` → `main`. Nobody commits straight to `preprod` or `main`.

**Versions are tags, not branches.**
- Each release to `main` is tagged `vMAJOR.MINOR.PATCH`, e.g. `v0.5.0`. It stays `0.x` until public launch.
- A tag marks exactly what shipped, so any version can be rebuilt.
- Long-lived version branches (v1, v2…) aren't used: they drift apart, and every fix has to be copied into each of them.
- The original v1 app is kept as the tag `v1-final`.

### Everyday flow

```bash
git switch dev && git pull
git switch -c feature/plans-timeline        # one change
# …commit as you go (pre-commit checks run)…
git push -u origin feature/plans-timeline   # pre-push checks run
# Open a PR into dev on GitHub; it merges when CI is green.
```

### Releasing

```bash
# dev → preprod: deploy and test on pre-production
git switch preprod && git pull && git merge --no-ff dev && git push
# preprod → main: release
git switch main && git pull && git merge --no-ff preprod
git tag -a v0.5.0 -m "v0.5.0 — Plans"
git push && git push origin v0.5.0           # the tag creates a GitHub Release
```

### Production hotfix

```bash
git switch main && git pull && git switch -c hotfix/prayer-time-offset
# fix + test, push, PR into main → merge → tag v0.5.1
# then carry the fix back so it isn't lost:
git switch preprod && git merge --no-ff main && git push
git switch dev && git merge --no-ff main && git push
```

## Checks

### On every commit (`.husky/pre-commit`, a few seconds)
1. **`scripts/guard-staged.mjs`** blocks:
   - `.env` files (only `.env.example` is allowed)
   - files over 2 MB
   - `console.log` in `apps/*/src`
2. **ESLint `--fix`** on staged files. The web app uses its own ESLint config.
3. **secretlint** on staged files: API keys, JWTs, private keys and credentials in URLs.

### On every push (`.husky/pre-push`, ~2 min)
`npm run verify` runs:
- the TypeScript typecheck (all workspaces)
- lint
- all tests
- `npm audit --omit=dev --audit-level=high`, which fails on high or critical issues in production dependencies

Hooks install automatically with `npm install` (the `prepare` script). In a real emergency, `git commit --no-verify` or `git push --no-verify` skips them; CI still checks everything.

### On GitHub (`.github/workflows`)
| Workflow | When | What |
|---|---|---|
| **ci** | PRs into, and pushes to, `dev` / `preprod` / `main` | `npm ci`, lint, typecheck, tests, production **build**, dependency audit, secret scan of tracked files |
| **codeql** | PRs, pushes to `preprod` / `main`, weekly | CodeQL bug and security analysis (`security-and-quality` queries) |
| **secrets** | PRs and pushes | gitleaks over the **full history** (`.gitleaks.toml` allowlists the documented local-dev placeholders) |
| **dependency-review** | PRs | Blocks new dependencies with high-severity advisories |
| **release** | A `v*.*.*` tag | Creates the GitHub Release with generated notes |
| **dependabot** | Weekly | Update PRs for npm and Actions, targeting `dev` |

## Turn on branch protection (owner, once)

This needs your repo admin rights, so it's done in GitHub's settings.

1. Go to **Settings → Rules → Rulesets → New ruleset → New branch ruleset**.
2. **Name:** `protect-main-preprod`. **Enforcement:** Active. **Target branches:** add `main` and `preprod`.
3. Tick these rules:
   - **Restrict deletions**
   - **Block force pushes**
   - **Require a pull request before merging** (approvals: 0 is fine while you're solo)
   - **Require status checks to pass**, then add `ci`, `analyze` (CodeQL) and `gitleaks`
4. Create a second ruleset for `dev`:
   - **Require status checks to pass** (`ci`)
   - **Block force pushes**
5. Optional: **Settings → Code security** → enable **Secret scanning** and **Push protection** (free for public repos).

## Deployments (later)

Pre-production and production hosting aren't set up yet. When they are:
- deploy `preprod` to the test environment and `main` to live, each with its own Supabase project and env vars
- never reuse production keys in pre-production
