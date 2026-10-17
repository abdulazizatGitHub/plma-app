// Smoke test for a deployed environment (docs/guides/DEPLOY_PREPROD.md).
// Reads NEXT_PUBLIC_API_URL and CORS_ORIGIN (the web app's URL) from .env.preprod.local
// (or ENV_FILE=…). Prints only pass/fail lines, never secrets.
//   node scripts/smoke-preprod.mjs
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const FILE = process.env.ENV_FILE ?? ".env.preprod.local";
if (!existsSync(FILE)) {
  console.error(`${FILE} not found — run node scripts/preprod-secrets.mjs first.`); // guard-allow
  process.exit(1);
}
const env = parseEnv(readFileSync(FILE, "utf8"));
const api = (env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const web = (env.CORS_ORIGIN ?? "").split(",")[0].replace(/\/$/, "");
if (!api || !web) {
  console.error("Set NEXT_PUBLIC_API_URL and CORS_ORIGIN in the env file first."); // guard-allow
  process.exit(1);
}

const results = [];
const check = async (name, run) => {
  try {
    const detail = await run();
    results.push(true);
    console.log(`PASS ${name}${detail ? ` — ${detail}` : ""}`); // guard-allow
  } catch (err) {
    results.push(false);
    console.log(`FAIL ${name} — ${err.message}`); // guard-allow
  }
};
const get = async (url, init) => {
  const r = await fetch(url, { redirect: "manual", ...init });
  return r;
};
const must = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

await check("API is up (/health)", async () => {
  const r = await get(`${api}/health`);
  must(r.ok, `HTTP ${r.status}`);
  return (await r.json()).status;
});
await check("API reaches the database (/health/db)", async () => {
  const r = await get(`${api}/health/db`);
  must(r.ok, `HTTP ${r.status}`);
  return (await r.json()).database;
});
await check("API refuses signed-out requests", async () => {
  const r = await get(`${api}/v1/me`);
  must(r.status === 401, `expected 401, got ${r.status}`);
});
await check("API allows the web app's origin (CORS, incl. PATCH)", async () => {
  const r = await get(`${api}/v1/me`, { method: "OPTIONS", headers: { Origin: web, "Access-Control-Request-Method": "PATCH", "Access-Control-Request-Headers": "content-type,authorization" } });
  must(r.headers.get("access-control-allow-origin") === web, `allow-origin is ${r.headers.get("access-control-allow-origin")}`);
  must((r.headers.get("access-control-allow-methods") ?? "").includes("PATCH"), "PATCH not allowed");
});
await check("API push key is configured (reminders)", async () => {
  const r = await get(`${api}/v1/push/key`);
  must(r.status !== 503, "VAPID keys missing on the API");
});
await check("Web app loads over HTTPS", async () => {
  must(web.startsWith("https://"), "web URL is not HTTPS (push and install need HTTPS)");
  const r = await get(`${web}/sign-in`);
  must(r.ok, `HTTP ${r.status}`);
});
await check("PWA: manifest with installable icons", async () => {
  const r = await get(`${web}/manifest.json`);
  must(r.ok, `HTTP ${r.status}`);
  const m = await r.json();
  must(m.display === "standalone", "display is not standalone");
  must(m.icons?.some((i) => i.sizes === "512x512") && m.icons?.some((i) => i.sizes === "192x192"), "missing 192/512 icons");
});
await check("PWA: service worker is served", async () => {
  const r = await get(`${web}/sw.js`);
  must(r.ok, `HTTP ${r.status}`);
});
await check("PWA: Apple touch icon", async () => {
  const r = await get(`${web}/icons/apple-touch-icon.png`);
  must(r.ok, `HTTP ${r.status}`);
});
await check("Web points at this API", async () => {
  // The API URL is baked into the web build; it shows up in the sign-in page's scripts.
  const html = await (await get(`${web}/sign-in`)).text();
  const scripts = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map((m) => m[1]).slice(0, 40);
  for (const s of scripts) if ((await (await get(`${web}${s}`)).text()).includes(api)) return "found in the build";
  throw new Error("API URL not found in the web build — check NEXT_PUBLIC_API_URL on Vercel and redeploy");
});

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} checks passed`); // guard-allow
process.exit(ok === results.length ? 0 : 1);
