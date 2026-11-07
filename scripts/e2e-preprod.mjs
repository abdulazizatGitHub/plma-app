// End-to-end check of a deployed API (docs/guides/DEPLOY_PREPROD.md) with two throwaway
// accounts: sign-in, sync, profile, friends, snaps, groups, rewards, leaderboards.
// Accounts are made with the Supabase admin API (no emails sent) and deleted at the end.
// Reads .env.preprod.local (or ENV_FILE=…). Prints pass/fail only; never keys or tokens.
//   node scripts/e2e-preprod.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { randomBytes, randomUUID, webcrypto } from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = parseEnv(readFileSync(path.join(ROOT, process.env.ENV_FILE ?? ".env.preprod.local"), "utf8"));
const require = createRequire(`${ROOT}/apps/api/package.json`);
const postgres = require("postgres");
const API = env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
const SB = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const WEB = env.CORS_ORIGIN.split(",")[0].trim();
const admin = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? ` — ${detail}` : ""}`); // guard-allow
};

async function occId(itemId, date, slot = "") {
  const b = new Uint8Array(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(`occ|${itemId}|${date}|${slot}`)));
  b[6] = (b[6] & 0x0f) | 0x80;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b.subarray(0, 16), (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

const users = [];
async function makeUser(label) {
  const email = `life-e2e-${label}-${randomBytes(4).toString("hex")}@example.com`;
  const password = `E2e!${randomBytes(9).toString("base64url")}a1`;
  const r = await fetch(`${SB}/auth/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: `E2E ${label}` } }) });
  const u = await r.json();
  if (!r.ok) throw new Error(`admin create failed: ${r.status} ${u.msg ?? u.message ?? ""}`);
  users.push(u.id);
  const t = await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const tok = await t.json();
  if (!t.ok) throw new Error(`sign-in failed: ${t.status}`);
  const call = async (method, path, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${tok.access_token}`, Origin: WEB, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let json = null;
    try { json = await res.json(); } catch { /* empty */ }
    return { status: res.status, json };
  };
  return { id: u.id, email, call };
}

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
const now = () => new Date().toISOString();

try {
  const A = await makeUser("a");
  const B = await makeUser("b");
  check("Sign-in works for new accounts (Supabase → API token check)", true);

  // Profile
  let r = await A.call("GET", "/v1/me");
  check("GET /v1/me returns the signed-in account", r.status === 200 && r.json?.id === A.id, `${r.status}`);
  const nameA = `e2ea${randomBytes(3).toString("hex")}`, nameB = `e2eb${randomBytes(3).toString("hex")}`;
  r = await A.call("GET", `/v1/usernames/${nameA}`);
  check("Username availability check", r.status === 200 && r.json?.available === true, JSON.stringify(r.json));
  r = await A.call("PATCH", "/v1/me", { displayName: "E2E Amina", username: nameA });
  check("PATCH profile (CORS PATCH path)", r.status === 200, `${r.status} ${JSON.stringify(r.json)}`);
  r = await B.call("PATCH", "/v1/me", { displayName: "E2E Bilal", username: nameB });
  check("Second account sets a username", r.status === 200, `${r.status}`);

  // Sync: category + item + today's occurrence done
  r = await A.call("GET", "/v1/sync/pull");
  check("Initial sync pull", r.status === 200 && !!r.json?.serverTime, `${r.status}`);
  const catId = randomUUID(), itemId = randomUUID(), t = now();
  const base = { userId: A.id, createdAt: t, updatedAt: t, deletedAt: null };
  const occ = await occId(itemId, today);
  r = await A.call("POST", "/v1/sync/push", {
    deviceId: "e2e",
    changes: [
      { entity: "categories", row: { id: catId, ...base, name: "E2E Physical", icon: "dumbbell", color: "mint", sortOrder: 0, archivedAt: null, remindersMuted: false, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null } },
      { entity: "items", row: { id: itemId, ...base, categoryId: catId, parentId: null, type: "habit", title: "E2E walk", notes: null, priority: "high", isOptional: false, tracking: { v: 1, kind: "check" }, schedule: { v: 1, kind: "daily" }, meta: {}, groupGoalId: null, sortOrder: 0, archivedAt: null, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null } },
      { entity: "occurrences", row: { id: occ, ...base, itemId, date: today, slot: "", status: "done", value: null, detail: null, movedTo: null, movedFrom: null, startedAt: null, completedAt: t, deviceId: "e2e" } },
    ],
  });
  check("Sync push: category, habit and a done day", r.status === 200, `${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  r = await A.call("GET", "/v1/sync/pull");
  const pulled = r.json?.changes ?? {};
  check("Sync pull returns them", (pulled.items ?? []).some((i) => i.id === itemId) && (pulled.occurrences ?? []).some((o) => o.id === occ && o.status === "done"), Object.keys(pulled).join(","));

  // Rewards
  r = await A.call("GET", "/v1/rewards");
  check("Rewards summary (points from the done item)", r.status === 200, `${r.status}`);

  // Friends
  r = await A.call("POST", "/v1/friends/request", { username: nameB });
  check("Friend request by @username", r.status === 200, `${r.status} ${JSON.stringify(r.json)}`);
  r = await B.call("GET", "/v1/friends");
  check("Request shows up for the other person", r.json?.incoming?.some((p) => p.id === A.id), JSON.stringify(r.json?.incoming));
  r = await B.call("POST", `/v1/friends/${A.id}/accept`);
  check("Accept friend request", r.status === 200, `${r.status}`);
  r = await A.call("GET", "/v1/friends");
  check("Both are friends", r.json?.friends?.some((p) => p.id === B.id), `${r.status}`);

  // Snaps
  r = await A.call("POST", "/v1/shares", { kind: "day", recipients: [B.id], date: today });
  const snapId = r.json?.id;
  check("Send a check-in snap", r.status === 200 && !!snapId, `${r.status} ${JSON.stringify(r.json)}`);
  r = await A.call("POST", "/v1/shares", { kind: "item_done", recipients: [B.id], itemId, date: today });
  check("Snap a finished item", r.status === 200, `${r.status} ${JSON.stringify(r.json)}`);
  r = await B.call("GET", "/v1/activity");
  check("Snap arrives in Activity", r.status === 200 && JSON.stringify(r.json).includes(snapId), `${r.status}`);
  r = await B.call("POST", `/v1/snaps/${snapId}/open`);
  check("Open the snap (first time shows it)", r.status === 200 && r.json?.opened === false && !!r.json?.payload, JSON.stringify(r.json));
  r = await B.call("POST", `/v1/snaps/${snapId}/open`);
  check("Open again: view once (no payload)", r.status === 200 && r.json?.payload === null, JSON.stringify(r.json));
  r = await B.call("POST", `/v1/shares/${snapId}/kudos`);
  check("Kudos", r.status === 200, `${r.status}`);
  r = await B.call("POST", "/v1/shares", { kind: "day", recipients: [A.id], date: today });
  check("Snap back", r.status === 200, `${r.status}`);
  r = await A.call("GET", "/v1/friends");
  const streak = r.json?.friends?.find((p) => p.id === B.id)?.streak;
  check("Friend streak starts (both snapped today)", (streak?.count ?? 0) >= 1, JSON.stringify(streak));

  // Privacy: a stranger can't snap
  r = await B.call("POST", "/v1/shares", { kind: "day", recipients: [randomUUID()], date: today });
  check("Can't snap a non-friend", r.status === 403, `${r.status}`);

  // Leaderboard
  r = await A.call("GET", "/v1/leaderboard?board=friends&period=week");
  check("Friends leaderboard", r.status === 200 && Array.isArray(r.json?.rows), `${r.status}`);

  // Groups
  r = await A.call("POST", "/v1/groups", { name: "E2E Family", icon: "home", color: "sky" });
  const gid = r.json?.id ?? r.json?.group?.id;
  check("Create a group", r.status === 200 && !!gid, `${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  r = await A.call("POST", `/v1/groups/${gid}/invite`, { friendIds: [B.id] });
  check("Invite a friend to the group", r.status === 200, `${r.status} ${JSON.stringify(r.json)}`);
  r = await B.call("GET", "/v1/groups");
  const inv = (r.json?.invites ?? []).find((i) => (i.groupId ?? i.group?.id) === gid);
  check("Invite shows for the friend", !!inv, JSON.stringify(r.json).slice(0, 300));
  if (inv) {
    r = await B.call("POST", `/v1/groups/invites/${inv.id}/accept`);
    check("Accept the group invite", r.status === 200, `${r.status} ${JSON.stringify(r.json)}`);
  }
  r = await A.call("POST", `/v1/groups/${gid}/goals`, { title: "E2E 70k steps", mode: "each", tracking: "quantity", unit: "steps", target: 70000, period: "week" });
  check("Add a group goal", r.status === 200, `${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  r = await B.call("GET", "/v1/sync/pull");
  check("Goal reaches the member's Today via sync", (r.json?.changes?.items ?? []).some((i) => i.groupGoalId && i.title === "E2E 70k steps"), "");
  r = await B.call("GET", `/v1/groups/${gid}`);
  check("Member can open the group", r.status === 200, `${r.status}`);
  r = await B.call("POST", `/v1/groups/${gid}/snaps`, {});
  check("Snap the group (check-in)", r.status === 200, `${r.status} ${JSON.stringify(r.json)}`);
  r = await A.call("GET", "/v1/groups/board?period=week&scope=mine");
  check("Groups board", r.status === 200, `${r.status}`);

  // Templates and push key
  r = await A.call("GET", "/v1/templates");
  check("Plan templates list", r.status === 200, `${r.status}`);
  r = await A.call("GET", "/v1/push/key");
  check("Push (VAPID) key is configured on the API", r.status === 200 && typeof r.json?.publicKey === "string" && r.json.publicKey.length > 40, `${r.status}`);
} catch (err) {
  fail++;
  console.log(`FAIL aborted — ${err.message}`); // guard-allow
} finally {
  // Clean up: app rows first, then the sign-in accounts.
  const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });
  try {
    if (users.length) {
      const owned = await sql`SELECT id FROM groups WHERE owner_id = ANY(${users}::uuid[])`;
      for (const g of owned) await sql`DELETE FROM groups WHERE id = ${g.id}`.catch(() => 0);
      await sql`DELETE FROM users WHERE id = ANY(${users}::uuid[])`;
    }
    const [left] = await sql`SELECT count(*)::int n FROM users WHERE id = ANY(${users}::uuid[])`;
    console.log(`cleanup: app rows left ${left.n}`); // guard-allow
  } catch (e) {
    console.log(`cleanup (app rows) failed — ${e.message}`); // guard-allow
  } finally {
    await sql.end();
  }
  for (const id of users) await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: admin });
  console.log(`cleanup: ${users.length} test sign-in accounts deleted`); // guard-allow
  console.log(`\n${pass}/${pass + fail} checks passed`); // guard-allow
  process.exit(fail ? 1 : 0);
}
