# Phase 06A — Accounts & Data Isolation

## Goal

Addendum A1 (ACC-01…03): real multi-user accounts. Each person signs up and sees only their own data, online and offline. This replaces the single built-in "Owner" user and shared API key.

## Why before customization

Customization (06B) creates per-user data. Building it on a single shared user would mean rewriting every query afterwards.

## Scope

- **Auth:** sign up, sign in, sign out, password reset, and session refresh. Provider: see DECISION.md (pending owner choice).
- **API:** the user comes from the verified session token, never the request body. `ensureDefaultUser()` and the shared `SYNC_API_KEY` stop being the source of identity.
- **Isolation:** every read and write is scoped to the authenticated `userId`. Sync push **verifies each `habitDefinitionId` belongs to the caller**, closing the current cross-user write hole.
- **No auto-seeding:** new users start empty; 06B adds the template picker.
- **Web:** auth screens (in the approved design language), a route guard for `(main)`, and a bearer token on sync calls.
- **Local store per user:** the local SQLite is keyed by user id and wiped on sign-out. A cached session still opens the app offline.

## Acceptance criteria

- [ ] Two accounts on one device see completely separate habits and logs
- [ ] A crafted push with another user's `habitDefinitionId` is rejected (API test)
- [ ] Signing out removes the previous user's local data
- [ ] App opens offline with a previously signed-in session
- [ ] A new account starts with zero habits

## Migration

The existing "Owner" user's data is kept. The owner's first sign-up can claim it, so nothing already logged is lost.
