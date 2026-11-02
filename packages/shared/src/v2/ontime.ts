import { MAX_DAY_END_HOUR } from "./day-access.js";
import type { Item, UserSettings } from "./entities.js";
import { prayerKeyOf } from "./prayer/prayer-set.js";
import { prayerTimes, zonedInstant, type PrayerTimeKey } from "./prayer/times.js";
import { anchorWindow, normalisePrayerKey, prayerWindow } from "./prayer/windows.js";

/*
 * When logging an item for a day stops being "on time" (owner, 2026-10-14).
 * Normally that's the end of the day (its day-end hour). But some things
 * belong to a window that runs past midnight: Isha is on time until Fajr, and
 * so is anything "after Isha". Logging those before their window ends is on
 * time, not late — even though the calendar day has changed.
 */

export type OnTimeSettings = Pick<UserSettings, "timezone" | "dayEndHour" | "lat" | "lng" | "calcMethod" | "madhab" | "prayerOffsets"> & {
  prayerManual?: Record<string, string> | null;
};

const TIME_KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

const nextDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/** The latest instant at which logging `item` for `date` still counts as on time. */
export function onTimeUntil(item: Pick<Item, "schedule" | "meta">, date: string, s: OnTimeSettings): Date {
  const h = Math.max(0, Math.min(MAX_DAY_END_HOUR, Math.round(s.dayEndHour ?? 0)));
  const dayEnd = zonedInstant(nextDate(date), `${String(h).padStart(2, "0")}:00`, s.timezone);
  let windowEnd: Date | null = null;
  const key = normalisePrayerKey(prayerKeyOf(item) ?? "");
  const anchor = item.schedule.kind !== "once" ? item.schedule.anchor : undefined;
  if (TIME_KEYS.includes(key) || anchor?.type === "prayer" || anchor?.type === "time") {
    const t = prayerTimes(date, s);
    if (TIME_KEYS.includes(key)) windowEnd = prayerWindow(key as PrayerTimeKey, t).end;
    else if (anchor) windowEnd = anchorWindow(anchor, t)?.end ?? null;
  }
  return windowEnd && windowEnd > dayEnd ? windowEnd : dayEnd;
}

/** Logged after its on-time point (the correction window): "late". */
export function isLateLog(item: Pick<Item, "schedule" | "meta">, date: string, editedAt: Date, s: OnTimeSettings): boolean {
  return editedAt.getTime() > onTimeUntil(item, date, s).getTime();
}
