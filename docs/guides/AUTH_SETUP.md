# Sign-in setup: email/password now, Google later

**Owner decision (2026-10-08):**
- Email and password ship in **v2 Phase 1**.
- Google sign-in is added **later**, after checking the Google Cloud console and billing constraints below.

Auth is provided by **Supabase Auth**, on the same Supabase project as the database.

## 1. Where the keys go

All secrets live in the **repo-root `.env.local`**. It is git-ignored, and both apps load it:

- **Web:** `apps/web/next.config.ts` fills in any variable not already set by `apps/web/.env*`.
- **API:** `apps/api/src/env.ts` and the migration scripts. The root file **wins** over `apps/api/.env`.

`.env.example` lists the names only and must never contain real values.

| Variable | Where to find it (Supabase dashboard) | Used by |
|----------|---------------------------------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL | Web, API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` / publishable key | Web, safe to expose |
| `SUPABASE_JWT_SECRET` | Project Settings → JWT Keys → legacy JWT secret | API: verifies HS256 access tokens |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` | **Server only, never in the browser.** Not used in Phase 1. |
| `DATABASE_URL` / `DIRECT_URL` | Project Settings → Database → connection strings | API, migrations |

The API accepts both token styles Supabase issues:
- **HS256 tokens** are checked with `SUPABASE_JWT_SECRET`.
- **ES256/RS256 tokens** (newer projects with asymmetric signing keys) are checked against the project's public JWKS at `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`. No extra configuration is needed.

## 2. Email/password: one-time dashboard steps

**How it works (owner decision, 2026-10-09):** email is verified with a **6-digit code**, not a link. Password reset uses a code the same way.

| Flow | What the user does |
|------|--------------------|
| **Sign up** | Enters name, email, password, confirms the password, and accepts the terms. Then types the code from the email, which signs them in. |
| **Sign in with an unconfirmed email** | The app sends a fresh code and asks for it. |
| **Forgot password** | Enters their email, then the code plus a new password. |

1. **Paste the branded templates** and set **Email OTP Length = 6**, OTP expiry **900 s**, and the **password requirements**. Follow [docs/email-templates/README.md](../email-templates/README.md).
2. **Authentication → Sign In / Providers → Email:**
   - Email sign-in is enabled (the default).
   - Keep **Confirm email** on.
3. **Authentication → URL Configuration:**
   - **Site URL:** `http://localhost:3000`. Change it to the production URL when deployed.
   - Redirect URLs aren't needed for the code flow; keep `http://localhost:3000/**` for later providers such as Google.
4. **Email sending limits:** Supabase's built-in email service is rate-limited to a few emails per hour and is meant for development. Before real users, set up custom SMTP under **Authentication → Emails → SMTP settings**. Brevo, Resend, and Amazon SES all have free tiers.
5. **Security (done by the Phase 1 migration):** Row Level Security is **enabled** on every app table.
   - The browser's anon key cannot read or write app data through Supabase's auto-generated REST API.
   - All app data goes through our Fastify API, which checks ownership.

## 3. Claiming the old (v1) data

The v1 app stored everything under one built-in "Owner" user. After you sign up and confirm your email, run this once:

```bash
npm run db:migrate:v1 -w @life/api -- --email you@example.com            # dry run: prints what would be created
npm run db:migrate:v1 -w @life/api -- --email you@example.com --apply    # writes it
```

This copies your old habits and logs into the new tables under your account. The old tables are left untouched.

## 4. Google sign-in: later, with these checks

Supabase handles the OAuth flow. We only need a Google **OAuth client ID and secret**.

**Steps (Google Cloud Console):**

1. Create or choose a project.
2. **APIs & Services → OAuth consent screen** (Google Auth Platform → Branding / Audience):
   - User type: **External**
   - App name, support email, developer email
   - Scopes: `openid`, `email`, `profile` (these are non-sensitive, so no Google review is required)
3. **Credentials → Create credentials → OAuth client ID → Web application:**
   - **Authorized JavaScript origins:** `http://localhost:3000` and the production URL.
   - **Authorized redirect URI:** `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Copy the client ID and secret into **Supabase → Authentication → Providers → Google**, and enable it.
5. While the consent screen is in **Testing** mode, only listed test users can sign in. Switch it to **In production** for everyone.

**The billing and account issues you mentioned:**

- Google sign-in uses **OAuth only**. It does not call a paid Google API, so it normally needs **no billing account and no card**.
- However, some brand-new Google Cloud accounts are asked for a card or account verification during setup, as a region or anti-abuse check. If that happens:
  - Use an **older Google account** that already has Cloud Console access, or one where verification was already completed.
  - Or create the project under a Google Workspace or organisation account.
  - If the console says "billing required" for a specific API: we don't need any extra API enabled for sign-in. Don't enable paid APIs just to get past the prompt.
- Adding a **logo** to the consent screen triggers brand verification, which takes days. Skip the logo at first.
- **Decision point:** before starting Google sign-in, do steps 1–3 once with the account you plan to use, and confirm no billing prompt blocks you. If one does, use the alternatives above. Email and password keep working regardless.

**App side, when we add it:**

- A "Continue with Google" button calls `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: <origin>/auth/callback } })`.
- No API changes are needed, because the tokens are the same kind of Supabase JWT.
