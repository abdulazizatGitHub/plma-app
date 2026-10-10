import { toLocalDateString } from "../date.js";
import type { Item } from "./entities.js";

/*
 * When is an item due? (SCH-01/02/05). Dates are user-local YYYY-MM-DD strings;
 * arithmetic goes through UTC so DST and the runtime's timezone never shift a day.
 * Anchors (after Zuhr…) don't change *which day* an item is due — they only
 * order and highlight it within the day (Phase 4).
 */

const toUtc = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: string): number {
  return new Date(toUtc(date)).getUTCDay();
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

function daysInMonth(date: string): number {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

type Schedulable = Pick<Item, "schedule" | "archivedAt" | "deletedAt" | "createdAt">;

/** True when the item has an instance on `date`. Archived/deleted items are never due. */
export function isDueOn(item: Schedulable, date: string): boolean {
  if (item.deletedAt || item.archivedAt) return false;
  const s = item.schedule;
  if (s.kind === "once") return s.date === date;
  if (s.activeFrom && date < s.activeFrom) return false;
  if (s.activeUntil && date > s.activeUntil) return false;
  switch (s.kind) {
    case "daily":
      return true;
    case "weekdays":
      return s.weekdays.includes(weekdayOf(date));
    case "everyNDays": {
      const start = s.activeFrom ?? toLocalDateString(new Date(item.createdAt));
      const gap = daysBetween(start, date);
      return gap >= 0 && gap % s.n === 0;
    }
    case "monthly": {
      const day = Number(date.slice(8, 10));
      return day === Math.min(s.monthDay, daysInMonth(date));
    }
  }
}

/** One-off task with no date — lives in the Pending list (SCH-05). */
export function isPending(item: Schedulable): boolean {
  return !item.deletedAt && !item.archivedAt && item.schedule.kind === "once" && item.schedule.date === null;
}

/** Short caption for a schedule, e.g. "Fridays · after dhuhr". */
export function describeSchedule(item: Pick<Item, "schedule">): string | null {
  const s = item.schedule;
  const anchor =
    s.kind !== "once" && s.anchor?.type === "prayer"
      ? `${s.anchor.relation} ${s.anchor.prayer}`
      : s.kind !== "once" && s.anchor?.type === "time"
        ? s.anchor.time
        : s.kind === "once" && s.time
          ? s.time
          : null;
  const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const DAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  const base =
    s.kind === "weekdays"
      ? s.weekdays.length === 1
        ? DAYS[s.weekdays[0]]
        : s.weekdays.map((d) => DAY[d]).join(" · ")
      : s.kind === "everyNDays"
        ? `Every ${s.n} days`
        : s.kind === "monthly"
          ? `Monthly, day ${s.monthDay}`
          : null;
  return [base, anchor].filter(Boolean).join(" · ") || null;
}
