import type { DayEntry } from "../day.js";
import type { Anchor } from "../tracking.js";
import { zonedInstant, type DayPrayerTimes, type PrayerTimeKey } from "./times.js";

/*
 * Time windows for prayers, anchors and day parts (SCH-03/04,
 * SYSTEM_DESIGN §5.1). Windows guide order and the "now" highlight; they never
 * stop an item being ticked.
 */

export type TimeWindow = { start: Date; end: Date };

/** The five obligatory prayers, in order. */
export const FARD_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

/** Older data and some users say "zuhr". */
export const normalisePrayerKey = (key: string) => (key === "zuhr" ? "dhuhr" : key);

const MIN = 60_000;
const AT_SPAN = 30 * MIN;

/** fajr→sunrise, sunrise→dhuhr, dhuhr→asr, asr→maghrib, maghrib→isha, isha→next fajr. */
export function prayerWindow(key: PrayerTimeKey, t: DayPrayerTimes): TimeWindow {
  const next: Record<PrayerTimeKey, Date> = {
    fajr: t.at.sunrise,
    sunrise: t.at.dhuhr,
    dhuhr: t.at.asr,
    asr: t.at.maghrib,
    maghrib: t.at.isha,
    isha: t.nextFajr,
  };
  return { start: t.at[key], end: next[key] };
}

const PREVIOUS: Record<PrayerTimeKey, PrayerTimeKey | null> = { fajr: null, sunrise: "fajr", dhuhr: "sunrise", asr: "dhuhr", maghrib: "asr", isha: "maghrib" };

const isTimeKey = (k: string): k is PrayerTimeKey => ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"].includes(k);

/**
 * Window of an anchor on the given day:
 *  - after X  = X → the next prayer
 *  - before X = the previous prayer → X (an hour before Fajr)
 *  - at X     = X ± 30 min
 * plus the anchor's offset. Custom prayer keys have no computed time → null.
 */
export function anchorWindow(anchor: Anchor, t: DayPrayerTimes): TimeWindow | null {
  if (anchor.type === "time") {
    const start = zonedInstant(t.date, anchor.time, t.timezone);
    return { start, end: new Date(start.getTime() + AT_SPAN) };
  }
  if (anchor.type !== "prayer") return null;
  const key = normalisePrayerKey(anchor.prayer);
  if (!isTimeKey(key)) return null;
  const shift = (anchor.offsetMin ?? 0) * MIN;
  const at = t.at[key].getTime();
  let w: TimeWindow;
  if (anchor.relation === "after") w = prayerWindow(key, t);
  else if (anchor.relation === "before") {
    const prev = PREVIOUS[key];
    w = { start: prev ? t.at[prev] : new Date(at - 60 * MIN), end: t.at[key] };
  } else w = { start: new Date(at - AT_SPAN), end: new Date(at + AT_SPAN) };
  return { start: new Date(w.start.getTime() + shift), end: new Date(w.end.getTime() + shift) };
}

/** An entry's window: its anchor (repeating items) or its time (one-off tasks, 30 min). */
export function entryWindow(entry: DayEntry, t: DayPrayerTimes): TimeWindow | null {
  const s = entry.item.schedule;
  if (s.kind === "once") {
    if (!s.time) return null;
    const start = zonedInstant(t.date, s.time, t.timezone);
    return { start, end: new Date(start.getTime() + AT_SPAN) };
  }
  return s.anchor ? anchorWindow(s.anchor, t) : null;
}

export const inWindow = (now: Date, w: TimeWindow) => now >= w.start && now < w.end;

/** The obligatory prayer whose time it is now (none between sunrise and Zuhr, or before Fajr). */
export function currentPrayer(now: Date, t: DayPrayerTimes): { key: PrayerTimeKey; window: TimeWindow } | null {
  for (const key of FARD_KEYS) {
    const w = prayerWindow(key, t);
    if (inWindow(now, w)) return { key, window: w };
  }
  return null;
}

/** The next obligatory prayer after `now` (tomorrow's Fajr after Isha). */
export function nextPrayer(now: Date, t: DayPrayerTimes): { key: PrayerTimeKey; at: Date } {
  for (const key of FARD_KEYS) if (t.at[key] > now) return { key, at: t.at[key] };
  return { key: "fajr", at: t.nextFajr };
}

/** "after Zuhr", "before Fajr +10 min"… for tags and the editor summary. */
export function describeAnchor(anchor: Anchor, prayerLabel: (key: string) => string): string {
  if (anchor.type === "time") return `at ${anchor.time}`;
  if (anchor.type === "dayPart") return anchor.key;
  const off = anchor.offsetMin ? ` ${anchor.offsetMin > 0 ? "+" : "−"}${Math.abs(anchor.offsetMin)} min` : "";
  return `${anchor.relation} ${prayerLabel(normalisePrayerKey(anchor.prayer))}${off}`;
}
