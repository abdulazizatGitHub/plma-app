import {
  countPrayersByStatus,
  parsePrayerPayload,
  PRAYER_NAMES,
  toLocalDateString,
  type PrayerLogPayload,
  type PrayerName,
  type PrayerStatus,
} from "@life/shared";

type LogLike = { habitDefinitionId: string; logDate: string; payload: unknown };

/** The first prayer (in daily order) still marked pending, or null when all five are logged. */
export function nextPendingPrayer(payload: unknown): PrayerName | null {
  const { prayers } = parsePrayerPayload(payload);
  return PRAYER_NAMES.find((name) => prayers[name] === "pending") ?? null;
}

/** A copy of the payload with one prayer's status replaced — never mutates the input. */
export function withPrayerStatus(
  payload: unknown,
  name: PrayerName,
  status: PrayerStatus,
): PrayerLogPayload {
  const parsed = parsePrayerPayload(payload);
  return { prayers: { ...parsed.prayers, [name]: status } };
}

function shiftDate(date: string, deltaDays: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return toLocalDateString(new Date(y, m - 1, d + deltaDays));
}

function payloadsByDate(logs: LogLike[], prayerDefId: string): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const log of logs) {
    if (log.habitDefinitionId === prayerDefId) map.set(log.logDate, log.payload);
  }
  return map;
}

/** Prayers completed on each of the last `days` days, oldest first, ending at `endDate`. */
export function weeklyPrayerCounts(
  logs: LogLike[],
  prayerDefId: string,
  endDate: string,
  days = 7,
): { date: string; value: number }[] {
  const byDate = payloadsByDate(logs, prayerDefId);
  return Array.from({ length: days }, (_, i) => {
    const date = shiftDate(endDate, i - (days - 1));
    return { date, value: countPrayersByStatus(byDate.get(date)).completed };
  });
}

/**
 * Consecutive days with all five prayers completed, counting back from
 * today — or from yesterday when today isn't finished yet, so an
 * in-progress day doesn't reset the streak to zero.
 */
export function prayerStreak(logs: LogLike[], prayerDefId: string, today: string): number {
  const byDate = payloadsByDate(logs, prayerDefId);
  const full = (date: string) =>
    countPrayersByStatus(byDate.get(date)).completed === PRAYER_NAMES.length;

  let cursor = full(today) ? today : shiftDate(today, -1);
  let streak = 0;
  while (full(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}
