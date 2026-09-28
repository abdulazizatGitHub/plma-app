import dns from "node:dns";
import postgres from "postgres";
import { databaseUrl } from "./load-env.mjs";

dns.setDefaultResultOrder("verbatim");

if (!databaseUrl) {
  console.error("DATABASE_URL missing in apps/api/.env");
  process.exit(1);
}

const sql = postgres(databaseUrl, { ssl: "require" });
try {
  const rows = await sql`select 1 as ok`;
  console.log("Postgres OK:", rows);
} finally {
  await sql.end();
}
