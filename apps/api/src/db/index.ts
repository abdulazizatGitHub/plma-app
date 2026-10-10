import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.js";
import * as schema from "./schema.js";

const connectionString = env.databaseUrl;

const client = postgres(connectionString, {
  max: 10,
  ssl:
    connectionString.includes("supabase") ||
    connectionString.includes("pooler.supabase.com")
      ? "require"
      : undefined,
  // Supabase's transaction pooler (port 6543) does not support prepared statements.
  prepare: !connectionString.includes(":6543"),
});

export const db = drizzle(client, { schema });
/** Raw postgres-js client, used by the generic v2 sync queries (sync/store.ts). */
export const pg = client;
export type Db = typeof db;
