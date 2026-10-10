import { ENTITY_SPECS, camelToSnake, entityColumns, snakeToCamel, type SyncEntity } from "@life/shared";
import type { Row } from "./plan.js";

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

/** Columns a sync upsert never overwrites on an existing row. */
const IMMUTABLE = new Set(["id", "userId", "createdAt"]);

/**
 * Builds one multi-row upsert for an entity. Identifiers come only from the
 * static registry; every value is a bound parameter. An existing row is only
 * replaced when it belongs to `userId` and the incoming `updatedAt` is not
 * older (last-write-wins). `synced_at` is stamped with server time.
 */
export function buildUpsert(entity: SyncEntity, rows: Row[], userId: string) {
  const { table, json } = ENTITY_SPECS[entity];
  const columns = entityColumns(entity);
  const params: unknown[] = [];
  const tuples = rows.map((row) => {
    const cells = columns.map((col) => {
      const value = row[col] ?? null;
      params.push(json.includes(col) && value !== null ? JSON.stringify(value) : value);
      return json.includes(col) ? `$${params.length}::jsonb` : `$${params.length}`;
    });
    return `(${[...cells, "now()"].join(", ")})`;
  });
  params.push(userId);
  const owner = `$${params.length}`;
  const t = quote(table);
  const names = [...columns.map((c) => quote(camelToSnake(c))), quote("synced_at")];
  const updates = [
    ...columns.filter((c) => !IMMUTABLE.has(c)).map((c) => `${quote(camelToSnake(c))} = EXCLUDED.${quote(camelToSnake(c))}`),
    `${quote("synced_at")} = now()`,
  ];
  const text =
    `INSERT INTO ${t} (${names.join(", ")}) VALUES ${tuples.join(", ")} ` +
    `ON CONFLICT ("id") DO UPDATE SET ${updates.join(", ")} ` +
    `WHERE ${t}."user_id" = ${owner} AND ${t}."updated_at" <= EXCLUDED."updated_at" ` +
    `RETURNING "id"`;
  return { text, params };
}

/**
 * Rows for a pull: everything changed since the cursor (with a small overlap so
 * rows committed just before the cursor are never missed — duplicates are
 * harmless under last-write-wins), or all live rows on a first pull.
 */
export function buildPull(entity: SyncEntity, userId: string, since?: string) {
  const t = quote(ENTITY_SPECS[entity].table);
  return since
    ? {
        text: `SELECT row_to_json(t) AS r FROM ${t} t WHERE t."user_id" = $1 AND t."synced_at" > $2::timestamptz - interval '10 seconds'`,
        params: [userId, since],
      }
    : {
        text: `SELECT row_to_json(t) AS r FROM ${t} t WHERE t."user_id" = $1 AND t."deleted_at" IS NULL`,
        params: [userId],
      };
}

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Postgres JSON row → API DTO: camelCase keys, ISO-Z timestamps, no `synced_at`. */
export function toDto(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === "synced_at") continue;
    out[snakeToCamel(key)] = typeof value === "string" && TIMESTAMP_RE.test(value) ? new Date(value).toISOString() : value;
  }
  return out;
}
