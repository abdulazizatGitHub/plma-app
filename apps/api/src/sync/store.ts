import { ENTITY_SPECS, SYNC_ENTITIES, defaultUserSettings, type SyncEntity, type SyncPullResponseV2 } from "@life/shared";
import type { Sql } from "postgres";
import type { AuthUser } from "../lib/auth.js";
import type { OwnershipLookup, Row } from "./plan.js";
import { buildPull, buildUpsert, toDto } from "./sql.js";

const table = (entity: SyncEntity) => `"${ENTITY_SPECS[entity].table}"`;

export function postgresLookup(sql: Sql): OwnershipLookup {
  return {
    async foreignIds(entity, ids, userId) {
      if (!ids.length) return [];
      const rows = await sql.unsafe(`SELECT "id" FROM ${table(entity)} WHERE "id" = ANY($1::uuid[]) AND "user_id" <> $2`, [ids, userId]);
      return rows.map((r) => r.id as string);
    },
    async ownedIds(entity, ids, userId) {
      if (!ids.length) return [];
      const rows = await sql.unsafe(`SELECT "id" FROM ${table(entity)} WHERE "id" = ANY($1::uuid[]) AND "user_id" = $2`, [ids, userId]);
      return rows.map((r) => r.id as string);
    },
  };
}

/** Writes a validated plan in one transaction. Returns how many rows were stale (server had newer). */
export async function applyPush(sql: Sql, userId: string, plan: Map<SyncEntity, Row[]>) {
  let accepted = 0;
  let total = 0;
  await sql.begin(async (tx) => {
    for (const [entity, rows] of plan) {
      total += rows.length;
      // Chunk to stay well under Postgres' parameter limit.
      for (let i = 0; i < rows.length; i += 100) {
        const { text, params } = buildUpsert(entity, rows.slice(i, i + 100), userId);
        const written = await tx.unsafe(text, params as never[]);
        accepted += written.length;
      }
    }
  });
  return { accepted, stale: total - accepted };
}

export async function pullChanges(sql: Sql, userId: string, since?: string): Promise<SyncPullResponseV2> {
  const [{ now }] = await sql`SELECT now() AS now`;
  const changes: SyncPullResponseV2["changes"] = {};
  for (const entity of SYNC_ENTITIES) {
    const { text, params } = buildPull(entity, userId, since);
    const rows = await sql.unsafe(text, params);
    if (rows.length) changes[entity] = rows.map((r) => toDto(r.r as Record<string, unknown>));
  }
  return { serverTime: new Date(now as string | Date).toISOString(), changes };
}

/**
 * Makes sure an authenticated user has a profile row and default settings
 * (Karachi method, Hanafi Asr, friends visibility). Cached per process.
 */
export type EnsureUser = ((user: AuthUser) => Promise<void>) & {
  /** Drop the "already exists" memo, e.g. after the row turned out to be missing. */
  forget: (userId: string) => void;
};

export function userBootstrapper(sql: Sql): EnsureUser {
  const known = new Set<string>();
  const ensureUser = async function ensureUser(user: AuthUser) {
    if (known.has(user.id)) return;
    const now = new Date().toISOString();
    const s = defaultUserSettings(user.id, now);
    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO users (id, email, display_name) VALUES (${user.id}, ${user.email}, ${user.name})
        ON CONFLICT (id) DO UPDATE SET
          email = COALESCE(EXCLUDED.email, users.email),
          display_name = COALESCE(EXCLUDED.display_name, users.display_name)`;
      await tx`
        INSERT INTO user_settings (id, user_id, timezone, week_start, calc_method, madhab, prayer_offsets, day_parts, visibility, created_at, updated_at)
        VALUES (${s.id}, ${s.userId}, ${s.timezone}, ${s.weekStart}, ${s.calcMethod}, ${s.madhab}, '{}'::jsonb, '[]'::jsonb, ${s.visibility}, ${now}, ${now})
        ON CONFLICT DO NOTHING`;
    });
    known.add(user.id);
  } as EnsureUser;
  ensureUser.forget = (userId: string) => {
    known.delete(userId);
  };
  return ensureUser;
}
