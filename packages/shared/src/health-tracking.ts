import { z } from "zod";
import { toLocalDateString } from "./date.js";

/*
 * Phase 05 — steps, water, exercise, sleep. Payload shapes for the generic
 * `habit_logs.payload` column plus the pure aggregations the UI shows.
 * Everything here tolerates malformed payloads (treated as "not logged")
 * rather than throwing, the same contract as prayer.ts.
 */

// ── Payloads ────────────────────────────────────────────────────────────

/** Steps and water: a running count for the day. */
export const counterLogPayloadSchema = z.object({
  value: z.number().int().nonnegative(),
});
export type CounterLogPayload = z.infer<typeof counterLogPayloadSchema>;

export const EXERCISE_TYPES = [
  "walk",
  "run",
  "gym",
  "yoga",
  "cycling",
  "swim",
  "sport",
  "other",
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const exerciseLogPayloadSchema = z.object({
  completed: z.boolean(),
  durationMinutes: z.number().int().positive().max(1440).optional(),
  type: z.enum(EXERCISE_TYPES).optional(),
});
export type ExerciseLogPayload = z.infer<typeof exerciseLogPayloadSchema>;

const MAX_SLEEP_MINUTES = 24 * 60;

/**
 * One night of sleep, logged on the **wake-up** date. Times are UTC
 * instants (docs/standards/IMPLEMENTATION.md: "instants in UTC for sleep").
 */
export const sleepLogPayloadSchema = z
  .object({
    bedAt: z.iso.datetime(),
    wakeAt: z.iso.datetime(),
  })
  .refine((p) => Date.parse(p.wakeAt) > Date.parse(p.bedAt), {
    message: "Wake time must be after bedtime",
  })
  .refine((p) => Date.parse(p.wakeAt) - Date.parse(p.bedAt) <= MAX_SLEEP_MINUTES * 60_000, {
    message: "Sleep can't be longer than 24 hours",
  });
export type SleepLogPayload = z.infer<typeof sleepLogPayloadSchema>;

export function counterValue(payload: unknown): number {
  const result = counterLogPayloadSchema.safeParse(payload);
  return result.success ? result.data.value : 0;
}

export function parseExercisePayload(payload: unknown): ExerciseLogPayload | null {
  const result = exerciseLogPayloadSchema.safeParse(payload);
  return result.success ? result.data : null;
}

export function parseSleepPayload(payload: unknown): SleepLogPayload | null {
  const result = sleepLogPayloadSchema.safeParse(payload);
  return result.success ? result.data : null;
}

// ── Clock & duration helpers ────────────────────────────────────────────

const CLOCK_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidClock(value: string): boolean {
  return CLOCK_RE.test(value);
}

/** "06:30" → 390 (minutes after local midnight). Throws on malformed input. */
export function parseClock(value: string): number {
  const match = CLOCK_RE.exec(value);
  if (!match) throw new Error(`Invalid clock time "${value}"; expected HH:MM`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** 390 → "06:30". Wraps values outside one day. */
export function formatClock(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 440 → "7h 20m"; 45 → "45m"; 120 → "2h". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Minutes after local midnight at which an instant falls, in the runtime's timezone. */
export function localClockMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export function sleepDurationMinutes(sleep: SleepLogPayload): number {
  return Math.round((Date.parse(sleep.wakeAt) - Date.parse(sleep.bedAt)) / 60_000);
}

/** True when the wake-up happened at or before the goal clock time (e.g. "06:00"). */
export function wokeByGoal(sleep: SleepLogPayload, wakeGoal: string): boolean {
  return localClockMinutes(sleep.wakeAt) <= parseClock(wakeGoal);
}

/**
 * Builds a sleep payload from two local clock times and the wake-up date.
 * Bedtime falls on the previous day when it's later on the clock than the
 * wake time (23:10 → 06:05); otherwise the same day (00:30 → 07:00).
 */
export function sleepWindowFromClock(
  wakeDate: string,
  bedClock: string,
  wakeClock: string,
): SleepLogPayload {
  const [y, m, d] = wakeDate.split("-").map(Number);
  const bedMinutes = parseClock(bedClock);
  const wakeMinutes = parseClock(wakeClock);
  const wake = new Date(y, m - 1, d, Math.floor(wakeMinutes / 60), wakeMinutes % 60);
  const bedDayOffset = bedMinutes >= wakeMinutes ? -1 : 0;
  const bed = new Date(
    y,
    m - 1,
    d + bedDayOffset,
    Math.floor(bedMinutes / 60),
    bedMinutes % 60,
  );
  return { bedAt: bed.toISOString(), wakeAt: wake.toISOString() };
}

// ── Periods ─────────────────────────────────────────────────────────────

export type HealthPeriod = "week" | "month";

function parseDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Local dates from the start of `today`'s period up to and including
 * `today`. Weeks start on Monday (docs/standards/IMPLEMENTATION.md).
 */
export function periodDates(period: HealthPeriod, today: string): string[] {
  const end = parseDate(today);
  const start =
    period === "month"
      ? new Date(end.getFullYear(), end.getMonth(), 1)
      : new Date(end.getFullYear(), end.getMonth(), end.getDate() - ((end.getDay() + 6) % 7));
  const dates: string[] = [];
  for (let cur = start; cur <= end; cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)) {
    dates.push(toLocalDateString(cur));
  }
  return dates;
}

/** The last `days` local dates ending on `endDate`, oldest first. */
export function lastNDates(endDate: string, days = 7): string[] {
  const end = parseDate(endDate);
  return Array.from({ length: days }, (_, i) =>
    toLocalDateString(new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1 - i))),
  );
}

// ── Aggregations ────────────────────────────────────────────────────────

type LogLike = { habitDefinitionId: string; logDate: string; payload: unknown };

function payloadsByDate(logs: LogLike[], defId: string): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const log of logs) {
    if (log.habitDefinitionId === defId) map.set(log.logDate, log.payload);
  }
  return map;
}

/** A per-day series of `read(payload)` over `dates` (0/undefined payload → read(undefined)). */
export function dailySeries(
  logs: LogLike[],
  defId: string,
  dates: string[],
  read: (payload: unknown) => number,
): { date: string; value: number }[] {
  const byDate = payloadsByDate(logs, defId);
  return dates.map((date) => ({ date, value: read(byDate.get(date)) }));
}

export type CounterSummary = {
  total: number;
  /** Mean per day across every day in the period, including unlogged days. */
  average: number;
  daysAtGoal: number;
  best: { date: string; value: number } | null;
};

export function summarizeCounter(
  logs: LogLike[],
  defId: string,
  dates: string[],
  goal: number,
): CounterSummary {
  const series = dailySeries(logs, defId, dates, counterValue);
  const total = series.reduce((s, d) => s + d.value, 0);
  const best = series.reduce<{ date: string; value: number } | null>(
    (acc, d) => (d.value > 0 && (!acc || d.value > acc.value) ? d : acc),
    null,
  );
  return {
    total,
    average: dates.length > 0 ? Math.round(total / dates.length) : 0,
    daysAtGoal: series.filter((d) => goal > 0 && d.value >= goal).length,
    best,
  };
}

export type ExerciseSummary = {
  activeDays: number;
  totalMinutes: number;
  topType: ExerciseType | null;
};

export function summarizeExercise(
  logs: LogLike[],
  defId: string,
  dates: string[],
): ExerciseSummary {
  const byDate = payloadsByDate(logs, defId);
  let activeDays = 0;
  let totalMinutes = 0;
  const typeCounts = new Map<ExerciseType, number>();
  for (const date of dates) {
    const p = parseExercisePayload(byDate.get(date));
    if (!p?.completed) continue;
    activeDays += 1;
    totalMinutes += p.durationMinutes ?? 0;
    if (p.type) typeCounts.set(p.type, (typeCounts.get(p.type) ?? 0) + 1);
  }
  let topType: ExerciseType | null = null;
  for (const [type, count] of typeCounts) {
    if (!topType || count > (typeCounts.get(topType) ?? 0)) topType = type;
  }
  return { activeDays, totalMinutes, topType };
}

export type SleepSummary = {
  nights: number;
  averageMinutes: number | null;
  /** Mean wake time as minutes after local midnight. */
  averageWakeMinutes: number | null;
  nightsOnGoal: number;
  /** Standard deviation of wake times in minutes — lower is more consistent. */
  wakeSpreadMinutes: number | null;
};

export function summarizeSleep(
  logs: LogLike[],
  defId: string,
  dates: string[],
  wakeGoal: string,
): SleepSummary {
  const byDate = payloadsByDate(logs, defId);
  const nights = dates
    .map((date) => parseSleepPayload(byDate.get(date)))
    .filter((p): p is SleepLogPayload => p !== null);

  if (nights.length === 0) {
    return {
      nights: 0,
      averageMinutes: null,
      averageWakeMinutes: null,
      nightsOnGoal: 0,
      wakeSpreadMinutes: null,
    };
  }

  const durations = nights.map(sleepDurationMinutes);
  const wakes = nights.map((n) => localClockMinutes(n.wakeAt));
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const wakeMean = mean(wakes);
  const variance = mean(wakes.map((w) => (w - wakeMean) ** 2));

  return {
    nights: nights.length,
    averageMinutes: Math.round(mean(durations)),
    averageWakeMinutes: Math.round(wakeMean),
    nightsOnGoal: nights.filter((n) => wokeByGoal(n, wakeGoal)).length,
    wakeSpreadMinutes: Math.round(Math.sqrt(variance)),
  };
}
