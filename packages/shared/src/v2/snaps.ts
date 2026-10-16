import { MAX_DAY_END_HOUR } from "./day-access.js";
import { zonedInstant } from "./prayer/times.js";

/*
 * Snaps and friend streaks (owner, 2026-10-16), like Snapchat: you and a
 * friend keep a 🔥 streak going by both sending each other a snap every day.
 * Each side counts by their own day (timezone and day-end hour). Today never
 * breaks a streak — it ends only when a whole day passes without both. ⌛
 * shows when today's exchange isn't done and under 4 hours are left.
 */

export const AT_RISK_HOURS = 4;

/** One day of a pair: did I send, did they send (each on their own date). */
export type SnapDay = { date: string; me: boolean; them: boolean };

export type FriendStreak = {
  count: number;
  best: number;
  /** Today: who has sent so far. */
  today: { me: boolean; them: boolean };
  /** Today isn't done yet, the streak is alive, and its day ends within 4 hours. */
  atRisk: boolean;
  /** When the streak would end if today isn't completed (ISO); null without a streak. */
  endsAt: string | null;
  /** A streak that ended yesterday (for a gentle "start again" line). */
  endedAt: number | null;
};

const prev = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
};
const next = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/** When `date` ends for someone: the next day at their day-end hour, in their timezone. */
export function dayEndsAt(date: string, timezone: string, dayEndHour = 0): Date {
  const h = Math.max(0, Math.min(MAX_DAY_END_HOUR, Math.round(dayEndHour)));
  return zonedInstant(next(date), `${String(h).padStart(2, "0")}:00`, timezone);
}

/** The streak with one friend from the pair's snap days. */
export function friendStreak(days: SnapDay[], today: string, now: Date, viewer: { timezone: string; dayEndHour: number }): FriendStreak {
  const both = new Set(days.filter((d) => d.me && d.them).map((d) => d.date));
  const t = days.find((d) => d.date === today);
  const todayState = { me: !!t?.me, them: !!t?.them };
  // Count back from today if it's done, else from yesterday (today is still open).
  let count = 0;
  for (let d = both.has(today) ? today : prev(today); both.has(d); d = prev(d)) count += 1;
  // Best run ever.
  let best = 0;
  let run = 0;
  let last: string | null = null;
  for (const d of [...both].sort()) {
    run = last && d === next(last) ? run + 1 : 1;
    best = Math.max(best, run);
    last = d;
  }
  const ends = dayEndsAt(today, viewer.timezone, viewer.dayEndHour);
  const done = both.has(today);
  const atRisk = count > 0 && !done && ends.getTime() - now.getTime() <= AT_RISK_HOURS * 3_600_000;
  // A streak that broke yesterday: the day before yesterday ended a run.
  let endedAt: number | null = null;
  if (count === 0 && !both.has(prev(today))) {
    let n = 0;
    for (let d = prev(prev(today)); both.has(d); d = prev(d)) n += 1;
    endedAt = n >= 2 ? n : null;
  }
  return { count, best: Math.max(best, count), today: todayState, atRisk, endsAt: count > 0 && !done ? ends.toISOString() : null, endedAt };
}

/** "3h left", "45m left". */
export function timeLeft(endsAt: string, now: Date): string {
  const ms = Math.max(0, new Date(endsAt).getTime() - now.getTime());
  const h = Math.floor(ms / 3_600_000);
  return h >= 1 ? `${h}h left` : `${Math.max(1, Math.round(ms / 60_000))}m left`;
}
