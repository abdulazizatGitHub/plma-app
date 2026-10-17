// Creates (or completes) .env.preprod.local with fresh secrets for preprod, without printing them.
// Run: node scripts/preprod-secrets.mjs   — then fill in the Supabase values it lists.
// Existing values are never overwritten. The file is git-ignored.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseEnv } from "node:util";

const FILE = ".env.preprod.local";
const require = createRequire(new URL("../apps/api/package.json", import.meta.url));
const webpush = require("web-push");

const current = existsSync(FILE) ? parseEnv(readFileSync(FILE, "utf8")) : {};
const vapid = webpush.generateVAPIDKeys();
const wanted = [
  ["# Supabase preprod project → Project Settings → API / Database / JWT Keys", null],
  ["DATABASE_URL", ""],
  ["NEXT_PUBLIC_SUPABASE_URL", ""],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", ""],
  ["SUPABASE_JWT_SECRET", ""],
  ["SUPABASE_SERVICE_ROLE_KEY", ""],
  ["# Hosting URLs (fill in after the first deploys)", null],
  ["NEXT_PUBLIC_API_URL", ""],
  ["CORS_ORIGIN", ""],
  ["# Generated here — Web Push keys and the notification-button signing secret", null],
  ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", vapid.publicKey],
  ["VAPID_PRIVATE_KEY", vapid.privateKey],
  ["VAPID_SUBJECT", "mailto:replace-with-your-contact@your-domain"],
  ["REMINDER_ACTION_SECRET", randomBytes(48).toString("base64url")],
];
const lines = [];
const added = [];
const todo = [];
for (const [key, value] of wanted) {
  if (value === null) {
    lines.push("", key);
    continue;
  }
  const have = current[key];
  const v = have !== undefined && have !== "" ? have : value;
  if ((have === undefined || have === "") && value) added.push(key);
  if (!v || v.includes("replace-with")) todo.push(key);
  lines.push(`${key}=${v}`);
}
for (const [key, value] of Object.entries(current)) if (!wanted.some(([k]) => k === key)) lines.push(`${key}=${value}`);
writeFileSync(FILE, lines.join("\n").trimStart() + "\n");
console.log(`${FILE} written (git-ignored).`); // guard-allow
console.log(added.length ? `Generated: ${added.join(", ")}` : "No new secrets needed."); // guard-allow
console.log(todo.length ? `Still to fill in: ${todo.join(", ")}` : "Everything is filled in."); // guard-allow
