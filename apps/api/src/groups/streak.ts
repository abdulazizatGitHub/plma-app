import { groupStreak } from "@life/shared";
import type { Db } from "../social/privacy.js";
import { viewerDay } from "../social/streaks.js";

const isoDay = (v: string | Date) => (typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10));

/** The best group streak in any group the user is in (for the group-streak awards). */
export async function bestGroupStreak(sql: Db, userId: string): Promise<number> {
  const groups = await sql<{ group_id: string }[]>`SELECT group_id FROM group_members WHERE user_id = ${userId} AND left_at IS NULL`;
  const v = await viewerDay(sql, userId);
  let best = 0;
  for (const { group_id } of groups) {
    const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM group_members WHERE group_id = ${group_id} AND left_at IS NULL`;
    const rows = await sql<{ date: string | Date; c: number }[]>`SELECT date, count(*)::int AS c FROM group_snap_days WHERE group_id = ${group_id} GROUP BY date`;
    best = Math.max(best, groupStreak(new Map(rows.map((r) => [isoDay(r.date), r.c])), n, v.today, new Date(), v).best);
  }
  return best;
}
