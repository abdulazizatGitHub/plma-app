import { daysBetween } from "./schedule.js";

/*
 * What can be done on a day (owner, 2026-10-12: daily items belong to their day).
 *  - live:    today — everything
 *  - late:    the last LOG_GRACE_DAYS days — log what you did but forgot to
 *             record; a prayer ticked late counts as qada
 *  - history: older days — read-only; unfinished items read as missed. One-off
 *             tasks can still be moved to today; missed prayers recovered as qada
 *  - planned: future days — plan (add, skip, move, edit) but not tick or log
 */

export type DayAccess = "live" | "late" | "history" | "planned";

/** Days after a day ends during which it can still be logged. */
export const LOG_GRACE_DAYS = 1;

export function dayAccess(date: string, today: string): DayAccess {
  if (date === today) return "live";
  if (date > today) return "planned";
  return daysBetween(date, today) <= LOG_GRACE_DAYS ? "late" : "history";
}

/** Ticking, steppers, checklists and minutes are allowed. */
export const canLog = (access: DayAccess) => access === "live" || access === "late";
