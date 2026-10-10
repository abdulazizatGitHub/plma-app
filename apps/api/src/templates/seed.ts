/*
 * Seeds the system starter packs into `templates` (safe to re-run):
 *   npm run db:seed:templates -w @life/api
 */
import { pg as sql } from "../db/index.js";
import { seedTemplates } from "./packs.js";

try {
  process.stdout.write(`Seeded ${await seedTemplates(sql)} starter packs.\n`);
} finally {
  await sql.end();
}
