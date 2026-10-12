import type { DayEntry } from "../day.js";
import { prayerMark } from "./insights.js";
import { prayerKeyOf } from "./prayer-set.js";
import type { DayPrayerTimes, PrayerTimeKey } from "./times.js";
import { FARD_KEYS, normalisePrayerKey, prayerWindow } from "./windows.js";

/*
 * Where each prayer stands right now (owner, 2026-10-12):
 *  - a prayer's time runs from its start to the next prayer (Isha until the
 *    next Fajr), so "Isha now · until 4:48 AM tomorrow" at 9 PM;
 *  - a prayer whose time passed unmarked is *not marked yet* — never assumed
 *    qada (people pray on time and mark later); it is missed only once its
 *    day has closed;
 *  - Hanafi preferred times (Isha before Islamic midnight, Asr before the sun
 *    yellows) are notes, never a status.
 */

const MIN = 60_000;
const TIME_KEYS: readonly string[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

export type PrayerTiming = {
  key: PrayerTimeKey;
  state: "upcoming" | "now" | "passed";
  start: Date;
  end: Date;
  /** Isha: its time runs past midnight into the next day. */
  endsNextDay: boolean;
  /** Soft note: best prayed before this (null = no note). */
  preferredEnd: Date | null;
};

const keyOf = (entry: Pick<DayEntry, "item">): string => normalisePrayerKey(prayerKeyOf(entry.item) ?? "");

/** The timing of a prayer on `t`'s day; null for prayers without a computed time (custom ones). */
export function prayerTiming(key: string, now: Date, t: DayPrayerTimes): PrayerTiming | null {
  const k = normalisePrayerKey(key);
  if (!TIME_KEYS.includes(k)) return null;
  const tk = k as PrayerTimeKey;
  const w = prayerWindow(tk, t);
  let preferredEnd: Date | null = null;
  if (tk === "isha") preferredEnd = new Date((t.at.maghrib.getTime() + t.nextFajr.getTime()) / 2);
  else if (tk === "asr") preferredEnd = new Date(t.at.maghrib.getTime() - 20 * MIN);
  return {
    key: tk,
    state: now < w.start ? "upcoming" : now < w.end ? "now" : "passed",
    start: w.start,
    end: w.end,
    endsNextDay: tk === "isha",
    preferredEnd,
  };
}

/**
 * What a prayer chip shows. `unmarked` = its time passed today and it isn't
 * marked yet (neutral, not qada). `open` = unmarked with no known time (a
 * custom prayer, or times not loaded yet).
 */
export type PrayerDisplay = "prayed" | "qada" | "missed" | "now" | "upcoming" | "unmarked" | "open";

export function prayerDisplay(entry: Pick<DayEntry, "item" | "occurrence">, date: string, today: string, now: Date, t: DayPrayerTimes | null): PrayerDisplay {
  const mark = prayerMark(entry, date, today);
  if (mark !== "open") return mark;
  if (date > today) return "upcoming";
  const timing = t && t.date === date ? prayerTiming(keyOf(entry), now, t) : null;
  if (!timing) return "open";
  return timing.state === "passed" ? "unmarked" : timing.state;
}

/** Can this prayer still be marked *on time* (its window is open), even if its day has locked? */
export function canMarkPrayerOnTime(key: string, now: Date, t: DayPrayerTimes): boolean {
  const timing = prayerTiming(key, now, t);
  return !!timing && timing.state === "now";
}

export type PrayerHeadline = {
  /** The prayer whose time it is, if it isn't marked yet. */
  current: { entry: DayEntry; timing: PrayerTiming } | null;
  /** The next prayer to start; `tomorrow` after Isha (tomorrow's Fajr). */
  next: { key: PrayerTimeKey; entry: DayEntry | null; at: Date; tomorrow: boolean } | null;
  /** Prayers whose time passed today without a mark. */
  unmarked: number;
};

/** Today's prayer situation for the card and the prayer block. */
export function prayerHeadline(children: DayEntry[], date: string, today: string, now: Date, t: DayPrayerTimes): PrayerHeadline {
  const byKey = new Map(children.map((c) => [keyOf(c), c]));
  let current: PrayerHeadline["current"] = null;
  let unmarked = 0;
  for (const c of children) {
    const d = prayerDisplay(c, date, today, now, t);
    if (d === "unmarked") unmarked += 1;
    if (d === "now" && !current) {
      const timing = prayerTiming(keyOf(c), now, t);
      if (timing && FARD_KEYS.includes(timing.key as (typeof FARD_KEYS)[number])) current = { entry: c, timing };
    }
  }
  let next: PrayerHeadline["next"] = null;
  for (const key of FARD_KEYS) {
    if (!byKey.has(key)) continue;
    if (t.at[key] > now) {
      next = { key, entry: byKey.get(key) ?? null, at: t.at[key], tomorrow: false };
      break;
    }
  }
  if (!next && byKey.has("fajr")) next = { key: "fajr", entry: null, at: t.nextFajr, tomorrow: true };
  return { current, next, unmarked };
}

/**
 * After midnight, yesterday's Isha is still on time until Fajr: the prayer to
 * show on Today (markable on time) while it's unmarked, else null.
 */
export function carryOverIsha(yesterdayChildren: DayEntry[], yesterday: string, today: string, now: Date, yesterdayTimes: DayPrayerTimes): DayEntry | null {
  const isha = yesterdayChildren.find((c) => keyOf(c) === "isha");
  if (!isha) return null;
  const o = isha.occurrence;
  if (o && (o.status === "done" || o.status === "missed")) return null;
  if (yesterday >= today) return null;
  return canMarkPrayerOnTime("isha", now, yesterdayTimes) ? isha : null;
}
