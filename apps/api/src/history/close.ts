import { LOG_GRACE_DAYS, closeDay, itemSchema, logicalDateIn, occurrenceSchema } from "@life/shared";
import type { Sql } from "postgres";
import { scoreRange } from "../rewards/engine.js";
import { buildUpsert, toDto } from "../sync/sql.js";

/*
 * Closing days on the server (FLX-06, Phase 7). Once a day's correction window
 * has ended, every open required repeating item is written down as missed, so
 * history can't change when schedules change later. Idempotent: rows have
 * deterministic ids and inserts skip existing rows.
 */

/** How far back a first run closes (so a long-idle account can't stall the sweep). */
const MAX_CATCH_UP_DAYS = 60;

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const isoDay = (v: string | Date | null) => (v ? (typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10)) : null);

/**
 * The sync upsert turned into insert-only: a row the user wrote meanwhile always
 * wins. The update branch goes, and so does the owner parameter only it used
 * (an unused parameter has no type and Postgres refuses the query).
 */
export function insertOnly(rows: Parameters<typeof buildUpsert>[1], userId: string): { text: string; params: unknown[] } {
  const { text, params } = buildUpsert("occurrences", rows, userId);
  const out = text.replace(/ON CONFLICT \("id"\) DO UPDATE SET[\s\S]*RETURNING "id"$/, 'ON CONFLICT DO NOTHING RETURNING "id"');
  if (out === text) throw new Error("insertOnly: unexpected upsert shape");
  return { text: out, params: params.slice(0, -1) };
}

/** Closes every day of one user that has left its window. Returns how many days were closed. */
export async function closeUserDays(sql: Sql, userId: string, now = new Date()): Promise<number> {
  const [u] = await sql<{ timezone: string | null; day_end_hour: number | null; closed_through: string | Date | null; created_at: Date }[]>`
    SELECT s.timezone, s.day_end_hour, u.closed_through, u.created_at FROM users u LEFT JOIN user_settings s ON s.user_id = u.id WHERE u.id = ${userId}`;
  if (!u) return 0;
  const tz = u.timezone ?? "Asia/Karachi";
  const today = logicalDateIn(now, tz, u.day_end_hour ?? 0);
  // Yesterday and the day before are still fixable; everything before is final.
  const last = addDays(today, -(LOG_GRACE_DAYS + 1));
  const created = logicalDateIn(new Date(u.created_at), tz, u.day_end_hour ?? 0);
  const floor = addDays(last, -MAX_CATCH_UP_DAYS);
  const from = isoDay(u.closed_through) ? addDays(isoDay(u.closed_through)!, 1) : created > floor ? created : floor;
  if (from > last) return 0;

  const items = (await sql.unsafe(`SELECT row_to_json(t) AS r FROM items t WHERE t.user_id = $1 AND t.deleted_at IS NULL`, [userId]))
    .map((e) => itemSchema.safeParse(toDto(e.r as Record<string, unknown>)))
    .flatMap((p) => (p.success ? [p.data] : []));
  const occs = (await sql.unsafe(
    `SELECT row_to_json(t) AS r FROM occurrences t WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.date BETWEEN $2::date AND $3::date`,
    [userId, from, last],
  ))
    .map((e) => occurrenceSchema.safeParse(toDto(e.r as Record<string, unknown>)))
    .flatMap((p) => (p.success ? [p.data] : []));

  const nowIso = now.toISOString();
  let closed = 0;
  await sql.begin(async (tx) => {
    for (let date = from; date <= last; date = addDays(date, 1)) {
      const missed = await closeDay(items, occs.filter((o) => o.date === date), date, userId, nowIso);
      if (missed.length) {
        const { text, params } = insertOnly(missed, userId);
        await tx.unsafe(text, params as never[]);
      }
      closed += 1;
    }
    await tx`UPDATE users SET closed_through = ${last} WHERE id = ${userId}`;
    // Rewards (Phase 8): a day is scored for good as it closes.
    await scoreRange(tx, userId, from, last, { timezone: tz, dayEndHour: u.day_end_hour ?? 0, closedThrough: last });
  });
  return closed;
}

/** Hourly: close days for every account. */
export async function closeAllDays(sql: Sql, now = new Date()) {
  const users = await sql<{ id: string }[]>`SELECT id FROM users`;
  let n = 0;
  for (const { id } of users) n += await closeUserDays(sql, id, now);
  return n;
}
