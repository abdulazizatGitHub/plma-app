# Deploying preprod

Preprod is a full copy of Mehrmah on free hosting, for testing on real phones over HTTPS. That covers installing the app, push reminders on Android and iPhone, and offline use. It has its own database and accounts, separate from dev.

| Part | Where | Free plan |
|------|-------|-----------|
| Web app (Next.js PWA) | **Vercel** (Hobby) | `https://mehrmah.vercel.app` |
| API (Fastify) | **Render** (Free web service), kept awake by a cron-job.org ping | `https://mehrmah-api.onrender.com` |
| Database, sign-in and email | **Supabase** (Free), a **new project** just for preprod | emails sent through a Gmail account (custom SMTP) |

Both hosts deploy the **`preprod`** branch. To release to preprod, merge `dev` into `preprod` and push. Both rebuild on their own.

This was decided on 2026-10-17 and changed to Render on 2026-11-07, because Northflank sign-up didn't work; see DECISION.md.

Time needed: about 45 minutes the first time.

---

## 1. Supabase: a new preprod project

1. At [supabase.com](https://supabase.com), choose **New project**.
   - **Name:** `life-preprod`
   - **Database password:** generate one and keep it in your password manager.
   - **Region:** the one nearest your testers. Pick the nearest Render region in step 4.
2. Wait for the project to finish setting up.
3. Collect these values. They go into `.env.preprod.local` in step 2.

   | Variable | Where in Supabase |
   |----------|-------------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → **Project URL** |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API Keys → **anon** (or **publishable**) key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys → **service_role** (or **secret**) key. Server only. |
   | `SUPABASE_JWT_SECRET` | Project Settings → JWT Keys → **legacy JWT secret**. If the project shows only new signing keys, leave this empty; the API checks tokens against the project's public keys automatically. |
   | `DATABASE_URL` | **Connect** → **Session pooler** connection string (port 5432), with your database password filled in |

   Use a **pooler** connection (session, port 5432, or transaction, port 6543), not the direct connection. The direct connection is IPv6-only, and most hosts, Render included, connect over IPv4.

4. Set up sign-in and the branded emails by following [`docs/email-templates/README.md`](../email-templates/README.md):
   - all four templates
   - Confirm email on
   - a 6-digit code that expires after 900 seconds
   - the password rules

   Leave the **URL Configuration** step for after step 5, when the Vercel URL is known.

## 2. Secrets file (on your computer)

```bash
node scripts/preprod-secrets.mjs
```

This creates `.env.preprod.local` in the repo root. The file is git-ignored.

- It already holds freshly generated Web Push keys and the notification-button secret.
- It never prints them, and running it again never overwrites a value.
- It lists what is still empty.

Paste in the five Supabase values from step 1. `NEXT_PUBLIC_API_URL` and `CORS_ORIGIN` come later, in steps 4 and 5.

`VAPID_SUBJECT` must be a contact the push services can reach, for example `mailto:` followed by an address you check, or your site's URL. The placeholder works for testing.

## 3. Database tables

From the repo root:

```bash
ENV_FILE=.env.preprod.local npm run db:migrate:manual -w @life/api
ENV_FILE=.env.preprod.local npm run db:seed:templates -w @life/api   # optional: plan presets
```

The first command creates every table, with row-level security on. The second is optional and adds the plan presets. Both are safe to run again; they skip anything already applied.

## 4. API on Render

1. At [render.com](https://render.com), choose **Sign up with GitHub** and allow access to this repository. No card is needed.
2. **New → Web Service** → pick the repository.
   - **Name:** `mehrmah-api`. **Branch:** `preprod`.
   - **Region:** the closest to the Supabase one (Singapore for a Tokyo database).
   - **Language:** Docker.
     - **Dockerfile Path:** `apps/api/Dockerfile`
     - **Docker Build Context Directory:** `.` (the repo root)
   - **Instance type:** Free (0.1 CPU, 512 MB).
   - **Health Check Path:** `/health` (under Advanced).
3. **Environment Variables.** Add these, copying the values from `.env.preprod.local`:

   ```text
   DATABASE_URL
   NEXT_PUBLIC_SUPABASE_URL
   SUPABASE_JWT_SECRET            (only if you filled it in)
   NEXT_PUBLIC_VAPID_PUBLIC_KEY
   VAPID_PRIVATE_KEY
   VAPID_SUBJECT
   REMINDER_ACTION_SECRET
   CORS_ORIGIN                    (fill in after step 5; until then the API refuses browser calls)
   ```

   Don't add `PORT`: Render sets it and the API reads it. `HOST` and `NODE_ENV` come from the Dockerfile. Don't add the service-role key or the anon key; the API doesn't use them.
4. **Deploy Web Service.** When it's running, copy the URL (`https://mehrmah-api.onrender.com`).
   - Put it in `.env.preprod.local` as `NEXT_PUBLIC_API_URL`, with no trailing slash.
   - Open `<url>/health/db`. It should say `"connected"`.
5. **Keep it awake.** A free Render service sleeps after 15 minutes without traffic, which would stop reminders (checked every minute).
   - At [cron-job.org](https://cron-job.org), create a job for `<url>/health` running **every 10 minutes**.
   - Render's 750 free hours a month cover one service running all month.

Run **only one** API instance. It also runs the reminder and day-closing jobs every minute and every hour. If you ever add a second instance, set `REMINDER_JOBS=off` on it.

## 5. Web app on Vercel

1. At [vercel.com](https://vercel.com): **Add New → Project** → import this repository.
2. **Root Directory:** `apps/web`. Vercel detects Next.js and the npm workspaces on its own.
   - **Build command:** leave the default. It runs `npm run build`, which is `next build --webpack`.
   - **Install command:** leave the default.
3. **Environment Variables**, for Production:

   ```text
   NEXT_PUBLIC_API_URL            the Render URL from step 4
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   HUSKY=0                        skips git hooks during install
   ```

   All three `NEXT_PUBLIC_*` values are built into the app. **After changing any of them, redeploy.**
4. **Deploy.** Then go to **Settings → Environments → Production → Branch Tracking** and set the branch to `preprod`. (It's no longer under Settings → Git.)
   - The next push to `preprod` makes the production build. Until then the URL shows `DEPLOYMENT_NOT_FOUND`.
   - Optional: under **Build and Deployment → Ignored Build Step**, build only the `preprod` branch, so `dev` pushes don't make preview builds.
5. Copy the production URL, `https://mehrmah.vercel.app`.
   - Put it in `.env.preprod.local` as `CORS_ORIGIN`.
   - Add it on Render as the `CORS_ORIGIN` environment variable. Render restarts the service by itself.
   - In Supabase → **Authentication → URL Configuration**:
     - **Site URL:** the Vercel URL
     - **Redirect URLs:** the Vercel URL followed by `/**`

## 6. Smoke test

```bash
node scripts/smoke-preprod.mjs
```

This checks:

- the API and its database
- that signed-out calls are refused
- CORS for the web app, including `PATCH`
- that the push keys are set
- HTTPS
- the manifest, icons and service worker
- that the web build points at this API

All 10 checks should pass. The script prints only pass or fail, never secrets.

Then by hand, with a real email address you can read. Don't use made-up addresses; bounced emails can get the project's email sending restricted.

1. **Sign up.**
   - The branded email arrives with a 6-digit code.
   - Entering the code leads to the first-run guide: intro, profile, your day, interests, then You're all set and the tour.
2. **Today:** add an item and finish it, and a ring fills. The Getting started card ticks it off.
3. **Sign out and sign in again.** Your data comes back from the server.
4. **Second account:** add the first account as a friend by @username, snap each other, and open the snap.
5. **Groups:** create a group, invite the friend, and set a goal. It appears on both Todays.
6. **Forgot password:** the reset code arrives and the new password works.

## 7. Phone checks (the reason for preprod)

| Check | Android (Chrome) | iPhone (Safari, iOS 16.4 or later) |
|-------|------------------|------------------------------------|
| Install | The banner's **Install** button installs the app. The icon shows rings on blue. | **How to install** walks through Share → Add to Home Screen. |
| Opens like an app | No browser bar. The status bar matches the theme. | Same, opened from the Home Screen icon |
| Reminders | Profile → Reminders → **Turn on**. A test reminder arrives, and **Done** on it marks the item done. | Only in the installed app. Then the same steps. |
| Offline | Airplane mode, then open the app. Today works; reconnect and it syncs. | Same |
| Location | Set my location → allow → prayer times update | Same |

Write the results in PROGRESS.md under Phase 6. Push on phones is the item still waiting for preprod.

## Releasing again

```bash
git checkout preprod && git merge --no-ff dev && git push   # Vercel and Render rebuild
```

- If the release adds a migration, run step 3 again **before** pushing.
- Migrations only ever add, so the old API keeps working meanwhile.
- After the deploy, run `node scripts/smoke-preprod.mjs`.

## Free plan limits

- **Supabase Free:**
  - A project **pauses after about a week with no activity**. Restore it from the dashboard; no data is lost.
  - Custom SMTP is required before templates can be edited. Gmail allows about 500 emails a day; Gmail-sent emails may land in spam until there's a domain.
  - Two free projects per account, so dev plus preprod fits.
- **Render Free:**
  - 0.1 CPU and 512 MB, which is enough for testing
  - sleeps after 15 minutes without traffic unless the cron-job.org ping runs; a cold start takes about a minute
  - each push to `preprod` rebuilds the image (about 5 minutes), with a short gap while the new one starts
- **Vercel Hobby:**
  - for personal and non-commercial use
  - production needs Pro or another host
- **No custom domain yet.**
  - The `vercel.app` and `onrender.com` URLs are permanent while the projects exist.
  - Moving to a domain later means updating `CORS_ORIGIN`, the Supabase URL settings and `NEXT_PUBLIC_API_URL`, then redeploying.
  - Installed copies of the app keep their old address, so testers reinstall.

## If something's wrong

| Symptom | Likely cause |
|---------|--------------|
| Sign-in works, but every screen says it can't reach the server | `CORS_ORIGIN` on Render doesn't exactly match the Vercel URL (no trailing slash), or `NEXT_PUBLIC_API_URL` on Vercel is wrong. **Redeploy** after fixing it. Or the API was asleep: check the cron-job.org ping. |
| Vercel URL shows `DEPLOYMENT_NOT_FOUND` | No production build from `preprod` yet. Push to `preprod`, or check Branch Tracking under Settings → Environments → Production. |
| `/health/db` fails | The `DATABASE_URL` password is wrong, you used the direct connection instead of the session pooler, or the Supabase project is paused |
| Everything gives 401 after signing in | `NEXT_PUBLIC_SUPABASE_URL` on Render points at a different project from the one the web app uses |
| "Reminders aren't available" | VAPID keys are missing on Render. `/v1/push/key` returns 503. |
| No sign-up email | Supabase's email limit has been reached. Wait an hour, or set up SMTP. |
| Install banner never shows | It is hidden once installed, for 14 days after **Not now**, and on unsupported browsers. Try a private window. |
