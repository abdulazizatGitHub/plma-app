/*
 * Claim the v1 "Owner" data for your new account (docs/guides/AUTH_SETUP.md §3).
 *
 *   npm run db:migrate:v1 -w @life/api -- --email you@example.com            # dry run
 *   npm run db:migrate:v1 -w @life/api -- --email you@example.com --apply    # write
 *   ... --from <uuid>   pick the old owner when several v1 users exist
 *
 * Sign in to the app once first, so your account row exists. Old tables are left
 * untouched; re-running is safe (deterministic ids + last-write-wins upsert).
 */
import { pg as sql } from "../db/index.js";
import { buildUpsert } from "../sync/sql.js";
import type { Row } from "../sync/plan.js";
import { mapV1ToV2, type V1Definition, type V1Log } from "./v1-to-v2.js";

const say = (line: string) => process.stdout.write(`${line}\n`);

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const email = arg("email");
const from = arg("from");
const apply = process.argv.includes("--apply");

const iso = (v: Date | string | null) => (v === null ? null : new Date(v).toISOString());

type DefRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  tracking_method: string;
  frequency: string;
  config: Record<string, unknown> | null;
  archived_at: Date | null;
  deleted_at: Date | null;
};
type LogRow = {
  id: string;
  habit_definition_id: string;
  log_date: string;
  payload: Record<string, unknown> | null;
  updated_at: Date;
  deleted_at: Date | null;
};

try {
  if (!email) throw new Error("Pass --email <the address you signed up with>");
  const [target] = await sql<{ id: string }[]>`SELECT id FROM users WHERE lower(email) = lower(${email})`;
  if (!target) throw new Error(`No account for ${email} yet — sign in to the app once, then re-run.`);

  const owners = await sql<{ id: string; name: string | null }[]>`
    SELECT DISTINCT d.user_id AS id, u.display_name AS name FROM habit_definitions d
    JOIN users u ON u.id = d.user_id WHERE d.user_id <> ${target.id}`;
  const source = from ? owners.find((o) => o.id === from) : owners.length === 1 ? owners[0] : undefined;
  if (!source) {
    throw new Error(
      owners.length
        ? `Several v1 users have data; pick one with --from: ${owners.map((o) => `${o.id} (${o.name ?? "unnamed"})`).join(", ")}`
        : "No v1 data found to migrate.",
    );
  }

  const defRows = await sql<DefRow[]>`
    SELECT id, slug, name, category, tracking_method, frequency, config, archived_at, deleted_at
    FROM habit_definitions WHERE user_id = ${source.id}`;
  const definitions = defRows.map((r): V1Definition => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category,
    trackingMethod: r.tracking_method,
    frequency: r.frequency,
    config: r.config ?? {},
    archivedAt: iso(r.archived_at),
    deletedAt: iso(r.deleted_at),
  }));
  const logRows = await sql<LogRow[]>`
    SELECT id, habit_definition_id, to_char(log_date, 'YYYY-MM-DD') AS log_date, payload, updated_at, deleted_at
    FROM habit_logs WHERE user_id = ${source.id}`;
  const logs = logRows.map((r): V1Log => ({
    id: r.id,
    habitDefinitionId: r.habit_definition_id,
    logDate: r.log_date,
    payload: r.payload ?? {},
    updatedAt: new Date(r.updated_at).toISOString(),
    deletedAt: iso(r.deleted_at),
  }));

  const out = mapV1ToV2({ userId: target.id, now: new Date().toISOString(), definitions, logs });
  say(`From ${source.id} → ${email}: ${definitions.length} habits, ${logs.length} logs`);
  say(`  → ${out.categories.length} categories, ${out.items.length} items, ${out.occurrences.length} occurrences`);

  if (!apply) {
    say("Dry run — nothing written. Re-run with --apply to write.");
  } else {
    const batches: ["categories" | "items" | "occurrences", Row[]][] = [
      ["categories", out.categories],
      ["items", out.items],
      ["occurrences", out.occurrences],
    ];
    await sql.begin(async (tx) => {
      for (const [entity, rows] of batches) {
        for (let i = 0; i < rows.length; i += 100) {
          const { text, params } = buildUpsert(entity, rows.slice(i, i + 100), target.id);
          await tx.unsafe(text, params as never[]);
        }
      }
    });
    say("Applied. Open the app and sync to see your history.");
  }
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
