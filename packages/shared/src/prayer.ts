import { z } from "zod";

export const PRAYER_NAMES = ["fajr", "zuhr", "asr", "maghrib", "isha"] as const;
export type PrayerName = (typeof PRAYER_NAMES)[number];

export const prayerStatusSchema = z.enum(["pending", "completed", "missed"]);
export type PrayerStatus = z.infer<typeof prayerStatusSchema>;

export const prayerLogPayloadSchema = z.object({
  prayers: z.object({
    fajr: prayerStatusSchema,
    zuhr: prayerStatusSchema,
    asr: prayerStatusSchema,
    maghrib: prayerStatusSchema,
    isha: prayerStatusSchema,
  }),
});
export type PrayerLogPayload = z.infer<typeof prayerLogPayloadSchema>;

export function emptyPrayerPayload(): PrayerLogPayload {
  return {
    prayers: {
      fajr: "pending",
      zuhr: "pending",
      asr: "pending",
      maghrib: "pending",
      isha: "pending",
    },
  };
}

/** Safely reads a possibly-malformed payload; unknown/missing shapes count as all-pending. */
export function parsePrayerPayload(payload: unknown): PrayerLogPayload {
  const result = prayerLogPayloadSchema.safeParse(payload);
  return result.success ? result.data : emptyPrayerPayload();
}

export function countPrayersByStatus(
  payload: unknown,
): Record<PrayerStatus, number> {
  const parsed = parsePrayerPayload(payload);
  const counts: Record<PrayerStatus, number> = {
    pending: 0,
    completed: 0,
    missed: 0,
  };
  for (const name of PRAYER_NAMES) {
    counts[parsed.prayers[name]] += 1;
  }
  return counts;
}

export function isPrayerDayComplete(payload: unknown): boolean {
  return countPrayersByStatus(payload).completed === PRAYER_NAMES.length;
}

export type PrayerDayStat = {
  date: string;
  completed: number;
  missed: number;
  pending: number;
  total: number;
  completionPercent: number;
};

export type PrayerReport = {
  month: string;
  days: PrayerDayStat[];
  totalCompleted: number;
  totalPossible: number;
  completionPercent: number;
};

const MONTH_RE = /^\d{4}-\d{2}$/;

/**
 * Aggregates prayer logs into a monthly report. `logs` may contain dates
 * outside `month` (they're filtered out) and may contain malformed payloads
 * (treated as all-pending rather than throwing).
 */
export function computeMonthlyPrayerReport(
  logs: { logDate: string; payload: unknown }[],
  month: string,
): PrayerReport {
  if (!MONTH_RE.test(month)) {
    throw new Error(`Invalid month "${month}"; expected YYYY-MM`);
  }

  const byDate = new Map<string, unknown>();
  for (const log of logs) {
    if (log.logDate.startsWith(month)) {
      byDate.set(log.logDate, log.payload);
    }
  }

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const days: PrayerDayStat[] = [];
  let totalCompleted = 0;

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${yearStr}-${monthStr}-${String(day).padStart(2, "0")}`;
    const counts = countPrayersByStatus(byDate.get(date));
    totalCompleted += counts.completed;
    days.push({
      date,
      completed: counts.completed,
      missed: counts.missed,
      pending: counts.pending,
      total: PRAYER_NAMES.length,
      completionPercent: Math.round((counts.completed / PRAYER_NAMES.length) * 100),
    });
  }

  const totalPossible = daysInMonth * PRAYER_NAMES.length;

  return {
    month,
    days,
    totalCompleted,
    totalPossible,
    completionPercent:
      totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0,
  };
}
