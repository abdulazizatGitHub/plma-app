import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Env loading order (docs/guides/AUTH_SETUP.md):
 *   1. `apps/api/.env` — optional API-only defaults
 *   2. repo-root `.env.local` — the owner's source of truth (Supabase URL/keys,
 *      JWT secret, current DATABASE_URL); wins on conflicts
 * Real environment variables (CI, hosting) always win over both files.
 */
const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.join(apiRoot, "../..");

const fromShell = new Set(Object.keys(process.env));
const root = dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true }).parsed ?? {};
const api = dotenv.config({ path: path.join(apiRoot, ".env"), quiet: true }).parsed ?? {};
for (const [key, value] of Object.entries({ ...api, ...root })) {
  if (!fromShell.has(key)) process.env[key] = value;
}

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://life:life_dev@localhost:5434/life",
  supabaseUrl: (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, ""),
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET ?? "",
  corsOrigins: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"],
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  /** Web Push (Phase 6). Without them reminders are off and the rest of the API still runs. */
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:reminders@example.com",
  reminderActionSecret: process.env.REMINDER_ACTION_SECRET ?? "",
  /** Set to "off" to run an API instance without the reminder scheduler. */
  reminderJobs: process.env.REMINDER_JOBS ?? "on",
};
