import { friendStreak, logicalDateIn, timeLeft, type FriendStreak, type SnapDay } from "@life/shared";
import type { PushSender } from "../reminders/service.js";
import { pair, people, type Db } from "./privacy.js";
import { pushToUser } from "./push.js";

/*
 * Friend snap streaks (owner, 2026-10-16). `snap_days` holds, per pair and
 * date, whether each side sent a snap that day (each on their own date).
 */

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const isoDay = (v: string | Date) => (typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10));

export type Viewer = { timezone: string; dayEndHour: number; today: string };

export async function viewerDay(sql: Db, userId: string, now = new Date()): Promise<Viewer> {
  const [s] = await sql<{ timezone: string | null; day_end_hour: number | null }[]>`SELECT timezone, day_end_hour FROM user_settings WHERE user_id = ${userId}`;
  const timezone = s?.timezone ?? "Asia/Karachi";
  const dayEndHour = s?.day_end_hour ?? 0;
  return { timezone, dayEndHour, today: logicalDateIn(now, timezone, dayEndHour) };
}

/** Marks that `senderId` snapped each recipient on the sender's own `date`. */
export async function markSnapDays(sql: Db, senderId: string, recipients: string[], date: string) {
  for (const r of recipients) {
    const [a, b] = pair(senderId, r);
    const aSent = a === senderId;
    await sql`
      INSERT INTO snap_days (user_a, user_b, date, a_sent, b_sent) VALUES (${a}, ${b}, ${date}, ${aSent}, ${!aSent})
      ON CONFLICT (user_a, user_b, date) DO UPDATE SET a_sent = snap_days.a_sent OR EXCLUDED.a_sent, b_sent = snap_days.b_sent OR EXCLUDED.b_sent`;
  }
}

/** Streaks between `userId` and each of `friendIds` (or everyone they've snapped with). */
export async function streaksFor(sql: Db, userId: string, friendIds: string[] | null, now = new Date()): Promise<Map<string, FriendStreak>> {
  const v = await viewerDay(sql, userId, now);
  const since = addDays(v.today, -400);
  const rows = await sql<{ user_a: string; user_b: string; date: string | Date; a_sent: boolean; b_sent: boolean }[]>`
    SELECT user_a, user_b, date, a_sent, b_sent FROM snap_days
    WHERE (user_a = ${userId} OR user_b = ${userId}) AND date >= ${since}::date`;
  const byFriend = new Map<string, SnapDay[]>();
  for (const r of rows) {
    const meIsA = r.user_a === userId;
    const other = meIsA ? r.user_b : r.user_a;
    byFriend.set(other, [...(byFriend.get(other) ?? []), { date: isoDay(r.date), me: meIsA ? r.a_sent : r.b_sent, them: meIsA ? r.b_sent : r.a_sent }]);
  }
  const ids = friendIds ?? [...byFriend.keys()];
  return new Map(ids.map((id) => [id, friendStreak(byFriend.get(id) ?? [], v.today, now, v)]));
}

/** The best snap streak with anyone (for the friend-streak awards). */
export async function bestFriendStreak(sql: Db, userId: string): Promise<number> {
  const all = await streaksFor(sql, userId, null);
  return Math.max(0, ...[...all.values()].map((s) => s.best));
}

/**
 * Hourly: "⌛ your 12-day streak with Sara ends in 3h" — once per user, friend
 * and day, only when they haven't snapped that friend today.
 */
export async function nudgeStreaks(sql: Db, send: PushSender | null, now = new Date()) {
  if (!send) return 0;
  const since = addDays(now.toISOString().slice(0, 10), -3);
  const users = await sql<{ id: string }[]>`
    SELECT DISTINCT unnest(ARRAY[user_a, user_b]) AS id FROM snap_days WHERE date >= ${since}::date AND a_sent AND b_sent`;
  let pushed = 0;
  for (const { id } of users) {
    const streaks = await streaksFor(sql, id, null, now);
    const risky = [...streaks.entries()].filter(([, s]) => s.atRisk && !s.today.me);
    if (!risky.length) continue;
    const v = await viewerDay(sql, id, now);
    const names = await people(sql, risky.map(([f]) => f));
    for (const [friend, s] of risky) {
      const fresh = await sql`INSERT INTO snap_nudges (user_id, friend_id, date) VALUES (${id}, ${friend}, ${v.today}) ON CONFLICT DO NOTHING RETURNING id`;
      if (!fresh.length) continue;
      const name = names.get(friend)?.name ?? "your friend";
      pushed += await pushToUser(sql, send, id, {
        title: `⌛ ${s.count}-day streak with ${name}`,
        body: `Snap ${name} before your day ends — ${timeLeft(s.endsAt!, now)}.`,
        url: "/activity",
        tag: `streak:${friend}`,
      });
    }
  }
  return pushed;
}
