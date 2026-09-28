import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(apiRoot, ".env"), override: true });

export const databaseUrl = process.env.DATABASE_URL;
