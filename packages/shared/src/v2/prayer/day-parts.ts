import type { DayEntry } from "../day.js";
import type { DayPrayerTimes } from "./times.js";
import { entryWindow, type TimeWindow } from "./windows.js";

/*
 * Day parts for Today's Day view (TOD-06, SCH-04), set by the prayers:
 * After Fajr · Morning · After Zuhr · After Asr · Evening · Night.
 * Items go to the part their window starts in; the rest are "Anytime".
 */

export type DayPart = { key: string; label: string; window: TimeWindow };

export const ANYTIME = "anytime";

export function dayParts(t: DayPrayerTimes): DayPart[] {
  const { at } = t;
  return [
    { key: "after_fajr", label: "After Fajr", window: { start: at.fajr, end: at.sunrise } },
    { key: "morning", label: "Morning", window: { start: at.sunrise, end: at.dhuhr } },
    { key: "after_dhuhr", label: "After Zuhr", window: { start: at.dhuhr, end: at.asr } },
    { key: "after_asr", label: "After Asr", window: { start: at.asr, end: at.maghrib } },
    { key: "evening", label: "Evening", window: { start: at.maghrib, end: at.isha } },
    { key: "night", label: "Night", window: { start: at.isha, end: t.nextFajr } },
  ];
}

/** The part an instant falls in. Before Fajr is still last night. */
export function partAt(instant: Date, parts: DayPart[]): string {
  const hit = parts.find((p) => instant >= p.window.start && instant < p.window.end);
  // Before Fajr (or past the night's end) still belongs to the night.
  return hit ? hit.key : "night";
}

/** Which part an entry belongs to, or "anytime" when it has no time. */
export function partOf(entry: DayEntry, t: DayPrayerTimes, parts: DayPart[] = dayParts(t)): string {
  const w = entryWindow(entry, t);
  return w ? partAt(w.start, parts) : ANYTIME;
}
