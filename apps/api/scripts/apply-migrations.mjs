// Applies every pending Drizzle migration listed in drizzle/meta/_journal.json.
// Used instead of `drizzle-kit migrate`, which exits 1 without output on Windows
// (PROJECT.md B-001). Each migration runs in one transaction and is recorded in
// drizzle.__drizzle_migrations by its tag, so re-running is safe.
import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { databaseUrl } from "./load-env.mjs";

dns.setDefaultResultOrder("verbatim");

if (!databaseUrl) {
  console.error("DATABASE_URL missing (apps/api/.env or repo-root .env.local)");
  process.exit(1);
}

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const journal = JSON.parse(fs.readFileSync(path.join(apiRoot, "drizzle/meta/_journal.json"), "utf8"));

const sql = postgres(databaseUrl, {
  ssl: databaseUrl.includes("supabase") ? "require" : undefined,
  max: 1,
  prepare: !databaseUrl.includes(":6543"),
});

try {
  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS drizzle;
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);

  for (const { tag } of journal.entries) {
    const [done] = await sql`SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${tag}`;
    if (done) {
      console.log(`✓ ${tag} (already applied)`);
      continue;
    }
    const statements = fs
      .readFileSync(path.join(apiRoot, "drizzle", `${tag}.sql`), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    await sql.begin(async (tx) => {
      for (const statement of statements) await tx.unsafe(statement);
      await tx`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${tag}, ${Date.now()})`;
    });
    console.log(`+ ${tag} (applied ${statements.length} statements)`);
  }

  const tables = await sql`
    SELECT c.relname AS name, c.relrowsecurity AS rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `;
  console.log("Public tables:", tables.map((t) => `${t.name}${t.rls ? "" : " (RLS OFF!)"}`).join(", "));
} finally {
  await sql.end();
}
