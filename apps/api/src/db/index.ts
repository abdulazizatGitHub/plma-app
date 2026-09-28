import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import * as schema from "./schema.js";

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(apiRoot, ".env"), override: true });

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://life:life_dev@localhost:5434/life";

const client = postgres(connectionString, {
  max: 10,
  ssl:
    connectionString.includes("supabase") ||
    connectionString.includes("pooler.supabase.com")
      ? "require"
      : undefined,
});

export const db = drizzle(client, { schema });
