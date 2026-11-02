import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Same order as src/env.ts: apps/api/.env, then repo-root .env.local (wins); the shell wins over both.
const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fromShell = new Set(Object.keys(process.env));
// ENV_FILE=.env.preprod.local points scripts (migrations, jobs) at another environment; it wins over .env.local.
const chosen = process.env.ENV_FILE ? path.resolve(apiRoot, "../..", process.env.ENV_FILE) : path.join(apiRoot, "../../.env.local");
const root = dotenv.config({ path: chosen, quiet: true }).parsed ?? {};
const api = dotenv.config({ path: path.join(apiRoot, ".env"), quiet: true }).parsed ?? {};
for (const [key, value] of Object.entries({ ...api, ...root })) {
  if (!fromShell.has(key)) process.env[key] = value;
}

export const databaseUrl = process.env.DATABASE_URL;
