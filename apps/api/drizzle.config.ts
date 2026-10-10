import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)));
// Same precedence as src/env.ts: repo-root .env.local wins over apps/api/.env.
dotenv.config({ path: path.join(apiRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(apiRoot, "../../.env.local"), override: true, quiet: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
