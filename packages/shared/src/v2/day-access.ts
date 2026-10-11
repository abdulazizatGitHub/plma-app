import { toLocalDateString } from "../date.js";
import { daysBetween } from "./schedule.js";

/*
 * What can be done on a day (owner, 2026-10-12: daily items belong to their day,
 * and a day locks at the user's day-end time so progress, streaks and rewards
 * are final).
 *  - live:    today — everything
 *  - late:    the last LOG_GRACE_DAYS days (0: off — a day locks when it ends)
 *  - history: a closed day — read-only; unfinished items read as missed. One-off
 *             tasks can still be moved to today; missed prayers recovered as qada
 *  - planned: future days — plan (add, skip, move, edit) but not tick or log
 */

export type DayAccess = "live" | "late" | "history" | "planned";

/** Days after a day ends during which it can still be logged (owner: none — the day locks). */
export const LOG_GRACE_DAYS = 0;

/** The latest day-end the settings offer: 4 AM (night owls). */
export const MAX_DAY_END_HOUR = 4;

/**
 * The user's "today": the calendar date, except that before their day-end hour
 * (e.g. 1:30 AM with the day ending at 2 AM) it is still the previous day.
 */
export function logicalToday(dayEndHour = 0, now: Date = new Date()): string {
  const h = Math.max(0, Math.min(MAX_DAY_END_HOUR, Math.round(dayEndHour)));
  return toLocalDateString(new Date(now.getTime() - h * 60 * 60 * 1000));
}

/** When the current day locks: the next day-end boundary after `now`. */
export function nextDayEnd(dayEndHour = 0, now: Date = new Date()): Date {
  const today = logicalToday(dayEndHour, now);
  const [y, m, d] = today.split("-").map(Number);
  return new Date(y, m - 1, d + 1, Math.max(0, Math.min(MAX_DAY_END_HOUR, dayEndHour)), 0, 0);
}

export function dayAccess(date: string, today: string): DayAccess {
  if (date === today) return "live";
  if (date > today) return "planned";
  return daysBetween(date, today) <= LOG_GRACE_DAYS ? "late" : "history";
}

/** Ticking, steppers, checklists and minutes are allowed. */
export const canLog = (access: DayAccess) => access === "live" || access === "late";
