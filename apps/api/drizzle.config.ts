import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.join(apiRoot, ".env"), override: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
