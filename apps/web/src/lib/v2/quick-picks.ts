import { FARD_KEYS, clockIn, localDateIn, zonedInstant, type DayPrayerTimes, type Trigger } from "@life/shared";

/*
 * One-tap reminder picks for "Remind me…" (owner, 2026-10-13): only the ones
 * that make sense right now — never a time that has passed, never one that
 * would spill into tomorrow.
 */

export type QuickPick = { id: string; label: string; /** "6:45 PM" */ sub: string; at: Date; trigger: Trigger };

type Input = {
  now: Date;
  /** The day the reminder is for. */
  date: string;
  timezone: string;
  /** The user's check-in time ("HH:mm"). */
  checkinTime: string;
  /** When the item itself is due that day, if it has a time. */
  itemAt: Date | null;
  times: DayPrayerTimes | null;
  /** The user's own prayer names by key (Zuhr, Jumu'ah…). */
  prayerName: (key: string) => string;
  format: (hhmm: string) => string;
};

const MIN = 60_000;

export function quickPicks({ now, date, timezone, checkinTime, itemAt, times, prayerName, format }: Input): QuickPick[] {
  const picks: QuickPick[] = [];
  const sameDay = (d: Date) => localDateIn(d, timezone) === date;
  const later = (d: Date) => d.getTime() > now.getTime() + MIN;
  const atTime = (id: string, label: string, at: Date) => {
    const hhmm = clockIn(at, timezone);
    picks.push({ id, label, sub: format(hhmm), at, trigger: { type: "at", time: hhmm } });
  };

  if (localDateIn(now, timezone) === date) {
    for (const m of [15, 30, 60]) {
      // Round up to the next minute so the reminder is never in the past by seconds.
      const at = new Date(Math.ceil((now.getTime() + m * MIN) / MIN) * MIN);
      if (sameDay(at)) atTime(`in${m}`, m === 60 ? "In 1 hour" : `In ${m} min`, at);
    }
  } else {
    const morning = zonedInstant(date, "09:00", timezone);
    if (later(morning)) atTime("morning", "Morning", morning);
  }

  const evening = zonedInstant(date, checkinTime, timezone);
  if (later(evening)) atTime("evening", "This evening", evening);

  if (itemAt) {
    const before = new Date(itemAt.getTime() - 15 * MIN);
    if (later(before) && sameDay(before)) atTime("before15", "15 min before it", before);
    if (later(itemAt) && sameDay(itemAt)) atTime("itsTime", "At its time", itemAt);
  }

  // The next prayer still to come that day (remind at its adhan).
  if (times && times.date === date) {
    const next = FARD_KEYS.find((k) => later(times.at[k]));
    if (next) {
      picks.push({
        id: `prayer-${next}`,
        label: `At ${prayerName(next)}`,
        sub: format(times.clock[next]),
        at: times.at[next],
        trigger: { type: "prayer", prayer: next, relation: "after", offsetMin: 0 },
      });
    }
  }

  // Soonest first, no duplicates of the same minute.
  const seen = new Set<string>();
  return picks
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .filter((p) => {
      const k = p.at.toISOString().slice(0, 16);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/** "HH:mm" about 30 min after now, rounded up to 5 minutes (a good place for the wheels to start). */
export function soonClock(now: Date, timezone: string): string {
  const [h, m] = clockIn(new Date(now.getTime() + 30 * MIN), timezone).split(":").map(Number);
  const t = Math.min(23 * 60 + 55, Math.ceil((h * 60 + m) / 5) * 5);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
