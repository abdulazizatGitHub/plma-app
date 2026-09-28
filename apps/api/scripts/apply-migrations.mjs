import dns from "node:dns";
import fs from "node:fs";

dns.setDefaultResultOrder("verbatim");
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { databaseUrl } from "./load-env.mjs";

if (!databaseUrl) {
  console.error("DATABASE_URL missing in apps/api/.env");
  process.exit(1);
}

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(apiRoot, "drizzle", "0000_yielding_talos.sql");
const sqlText = fs.readFileSync(migrationPath, "utf8");

const statements = sqlText
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

const sql = postgres(databaseUrl, { ssl: "require", max: 1 });

try {
  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS drizzle;
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);

  const existing = await sql`
    SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '0000_yielding_talos'
  `;

  if (existing.length === 0) {
    for (const statement of statements) {
      await sql.unsafe(statement);
    }
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES ('0000_yielding_talos', ${Date.now()})
    `;
    console.log("Applied migration 0000_yielding_talos");
  } else {
    console.log("Migration 0000_yielding_talos already applied");
  }

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('users', 'habit_definitions', 'habit_logs')
    ORDER BY table_name
  `;
  console.log(
    "Public tables:",
    tables.map((r) => r.table_name).join(", "),
  );
} finally {
  await sql.end();
}
