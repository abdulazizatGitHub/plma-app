import type {
  ExerciseType,
  HabitDefinitionDto,
  HabitLogDto,
  PrayerLogPayload,
} from "@life/shared";
import {
  countPrayersByStatus,
  formatClock,
  formatDuration,
  isFriday,
  isQuranLogDone,
  isValidClock,
  localClockMinutes,
  parseExercisePayload,
  parsePrayerPayload,
  parseSleepPayload,
  sleepDurationMinutes,
  toLocalDateString,
  todayLocalDate,
  wokeByGoal,
} from "@life/shared";

export const DEFAULT_WAKE_GOAL = "06:00";

export type SleepRowState = {
  wakeGoal: string;
  /** Last night's sleep, logged on today's (wake-up) date — null until logged. */
  logged: {
    durationMinutes: number;
    bedClock: string;
    wakeClock: string;
    wokeByGoal: boolean;
  } | null;
};

export type QuranRowState = {
  mulkId?: string;
  mulkDone: boolean;
  kahfId?: string;
  kahfDone: boolean;
  friday: boolean;
};

export type DashboardRow = {
  key: string;
  label: string;
  value: string;
  done: boolean;
  count?: { completed: number; total: number };
  /** Per-prayer statuses for today — present only when the prayer habit is configured. */
  prayers?: PrayerLogPayload["prayers"];
  /** Mulk/Kahf ids and done-state so the UI can log them directly — present when either is configured. */
  quran?: QuranRowState;
  /** Present only when this row is backed by a real habit definition the user can act on directly. */
  habitDefinitionId?: string;
  /** Present only for counter-tracked rows (steps, water) — lets the UI offer a quick increment. */
  counter?: { actual: number; goal: number };
  /** Exercise details for today — present when the exercise habit is configured. */
  exercise?: { durationMinutes?: number; type?: ExerciseType };
  /** Sleep goal + last night's log — present when the sleep habit is configured. */
  sleep?: SleepRowState;
  /** False for rows shown for CRD completeness but not yet wired to a habit definition (reading, study). */
  available?: boolean;
};

function defBySlug(defs: HabitDefinitionDto[], slug: string) {
  return defs.find((d) => d.slug === slug);
}

function logForDef(logs: HabitLogDto[], habitDefinitionId: string) {
  return logs.find((l) => l.habitDefinitionId === habitDefinitionId);
}

function prayerSummary(defs: HabitDefinitionDto[], logs: HabitLogDto[]) {
  const def = defBySlug(defs, "prayer");
  if (!def) {
    return { value: "—", done: false, completed: 0, total: 5, id: undefined, prayers: undefined };
  }
  const log = logForDef(logs, def.id);
  const counts = countPrayersByStatus(log?.payload);
  return {
    value: `${counts.completed}/5`,
    done: counts.completed === 5,
    completed: counts.completed,
    total: 5,
    id: def.id,
    prayers: parsePrayerPayload(log?.payload).prayers,
  };
}

function quranSummary(defs: HabitDefinitionDto[], logs: HabitLogDto[], date: string) {
  const mulk = defBySlug(defs, "quran-mulk");
  const kahf = defBySlug(defs, "quran-kahf");
  const friday = isFriday(date);
  const mulkDone = mulk ? isQuranLogDone(logForDef(logs, mulk.id)?.payload) : false;
  const kahfDone = kahf ? isQuranLogDone(logForDef(logs, kahf.id)?.payload) : false;
  let done = 0;
  let total = 0;

  if (mulk) {
    total += 1;
    if (mulkDone) done += 1;
  }
  if (kahf && friday) {
    total += 1;
    if (kahfDone) done += 1;
  }

  const state: QuranRowState | undefined =
    mulk || kahf ? { mulkId: mulk?.id, mulkDone, kahfId: kahf?.id, kahfDone, friday } : undefined;

  const value =
    total === 0
      ? "N/A"
      : friday
        ? `${done}/${total}`
        : mulk
          ? isQuranLogDone(logForDef(logs, mulk.id)?.payload)
            ? "1/1"
            : "0/1"
          : "0/1";

  return {
    value,
    done: total > 0 && done === total,
    completed: done,
    total: total || 1,
    state,
  };
}

function counterSummary(
  def: HabitDefinitionDto | undefined,
  logs: HabitLogDto[],
  fallbackGoal: number,
  unitLabel: string,
) {
  if (!def) return { value: "—", done: false, completed: 0, total: 1, id: undefined, actual: 0, goal: 0 };
  const goal = Number(def.config?.goal ?? fallbackGoal);
  const log = logForDef(logs, def.id);
  const actual = Number(log?.payload?.value ?? 0);
  const done = actual >= goal;
  return {
    value:
      unitLabel === "steps"
        ? `${actual.toLocaleString()}/${goal.toLocaleString()}`
        : `${actual}/${goal}`,
    done,
    completed: done ? 1 : 0,
    total: 1,
    id: def.id,
    actual,
    goal,
  };
}

function booleanSummary(
  def: HabitDefinitionDto | undefined,
  logs: HabitLogDto[],
  labelDone = "Completed",
  labelPending = "Pending",
) {
  if (!def) return { value: "—", done: false, completed: 0, total: 1, id: undefined };
  const log = logForDef(logs, def.id);
  const completed = log?.payload?.completed === true;
  return {
    value: completed ? labelDone : labelPending,
    done: completed,
    completed: completed ? 1 : 0,
    total: 1,
    id: def.id,
  };
}

const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  walk: "Walk",
  run: "Run",
  gym: "Gym",
  yoga: "Yoga",
  cycling: "Cycling",
  swim: "Swim",
  sport: "Sport",
  other: "Other",
};

export function exerciseTypeLabel(type: ExerciseType): string {
  return EXERCISE_TYPE_LABELS[type];
}

function exerciseSummary(def: HabitDefinitionDto | undefined, logs: HabitLogDto[]) {
  if (!def) {
    return { value: "—", done: false, completed: 0, total: 1, id: undefined, details: undefined };
  }
  const parsed = parseExercisePayload(logForDef(logs, def.id)?.payload);
  const completed = parsed?.completed === true;
  const parts = [
    parsed?.durationMinutes ? `${parsed.durationMinutes} min` : null,
    parsed?.type ? EXERCISE_TYPE_LABELS[parsed.type] : null,
  ].filter(Boolean);
  return {
    value: completed ? (parts.length ? parts.join(" · ") : "Completed") : "Pending",
    done: completed,
    completed: completed ? 1 : 0,
    total: 1,
    id: def.id,
    details: { durationMinutes: parsed?.durationMinutes, type: parsed?.type },
  };
}

function sleepSummary(def: HabitDefinitionDto | undefined, logs: HabitLogDto[]) {
  if (!def) {
    return { value: "—", done: false, completed: 0, total: 1, id: undefined, state: undefined };
  }
  const configured = def.config?.wakeGoal;
  const wakeGoal =
    typeof configured === "string" && isValidClock(configured) ? configured : DEFAULT_WAKE_GOAL;
  const sleep = parseSleepPayload(logForDef(logs, def.id)?.payload);
  const logged = sleep
    ? {
        durationMinutes: sleepDurationMinutes(sleep),
        bedClock: formatClock(localClockMinutes(sleep.bedAt)),
        wakeClock: formatClock(localClockMinutes(sleep.wakeAt)),
        wokeByGoal: wokeByGoal(sleep, wakeGoal),
      }
    : null;
  return {
    value: logged ? formatDuration(logged.durationMinutes) : "Not logged",
    done: logged !== null,
    completed: logged ? 1 : 0,
    total: 1,
    id: def.id,
    state: { wakeGoal, logged } satisfies SleepRowState,
  };
}

export function buildTodayDashboard(
  definitions: HabitDefinitionDto[],
  logs: HabitLogDto[],
  date = todayLocalDate(),
): { rows: DashboardRow[]; completionPercent: number } {
  const dayLogs = logs.filter((l) => l.logDate === date);

  const prayer = prayerSummary(definitions, dayLogs);
  const quran = quranSummary(definitions, dayLogs, date);
  const steps = counterSummary(
    defBySlug(definitions, "steps"),
    dayLogs,
    10000,
    "steps",
  );
  const water = counterSummary(
    defBySlug(definitions, "water"),
    dayLogs,
    8,
    "glasses",
  );
  const exercise = exerciseSummary(defBySlug(definitions, "exercise"), dayLogs);
  const sleep = sleepSummary(defBySlug(definitions, "sleep"), dayLogs);
  const makeBed = booleanSummary(
    defBySlug(definitions, "make-bed"),
    dayLogs,
  );
  const noPhone = booleanSummary(
    defBySlug(definitions, "no-phone-hour"),
    dayLogs,
  );

  const rows: DashboardRow[] = [
    {
      key: "prayer",
      label: "Prayer",
      value: prayer.value,
      done: prayer.done,
      count: { completed: prayer.completed, total: prayer.total },
      habitDefinitionId: prayer.id,
      prayers: prayer.prayers,
    },
    { key: "quran", label: "Quran", value: quran.value, done: quran.done, quran: quran.state },
    {
      key: "steps",
      label: "Steps",
      value: steps.value,
      done: steps.done,
      habitDefinitionId: steps.id,
      counter: steps.id ? { actual: steps.actual, goal: steps.goal } : undefined,
    },
    {
      key: "water",
      label: "Water",
      value: water.value,
      done: water.done,
      habitDefinitionId: water.id,
      counter: water.id ? { actual: water.actual, goal: water.goal } : undefined,
    },
    {
      key: "exercise",
      label: "Exercise",
      value: exercise.value,
      done: exercise.done,
      habitDefinitionId: exercise.id,
      exercise: exercise.details,
    },
    {
      key: "sleep",
      label: "Sleep",
      value: sleep.value,
      done: sleep.done,
      habitDefinitionId: sleep.id,
      sleep: sleep.state,
    },
    {
      key: "reading",
      label: "Reading",
      value: "Not tracked yet",
      done: false,
      available: false,
    },
    {
      key: "study",
      label: "Study",
      value: "Not tracked yet",
      done: false,
      available: false,
    },
    {
      key: "make-bed",
      label: "Make bed",
      value: makeBed.value,
      done: makeBed.done,
      habitDefinitionId: makeBed.id,
    },
    {
      key: "no-phone",
      label: "No phone",
      value: noPhone.value,
      done: noPhone.done,
      habitDefinitionId: noPhone.id,
    },
  ];

  const tracked = [
    prayer,
    quran,
    steps,
    water,
    exercise,
    sleep,
    makeBed,
    noPhone,
  ];
  const completedUnits = tracked.reduce((s, t) => s + t.completed, 0);
  const totalUnits = tracked.reduce((s, t) => s + t.total, 0);
  const completionPercent =
    totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

  return { rows, completionPercent };
}

/**
 * Per-row done/not-done for each of the last `days` days (oldest first,
 * ending at `endDate` inclusive), keyed by DashboardRow.key. Reuses
 * buildTodayDashboard's own per-day logic so a row's "done" definition
 * never drifts between the today view and its history strip.
 */
export function buildHabitHistoryStrips(
  definitions: HabitDefinitionDto[],
  logs: HabitLogDto[],
  days = 7,
  endDate = todayLocalDate(),
): Record<string, boolean[]> {
  const [year, month, day] = endDate.split("-").map(Number);
  const dates = Array.from({ length: days }, (_, i) =>
    toLocalDateString(new Date(year, month - 1, day - (days - 1 - i))),
  );

  const perDate = dates.map((date) => buildTodayDashboard(definitions, logs, date));
  const result: Record<string, boolean[]> = {};
  for (const row of perDate[perDate.length - 1]?.rows ?? []) {
    result[row.key] = perDate.map(
      (d) => d.rows.find((r) => r.key === row.key)?.done ?? false,
    );
  }
  return result;
}

/**
 * Daily completion % for each of the last `days` days (oldest first,
 * ending at `endDate`). Reuses buildTodayDashboard per date so the weekly
 * chart can never disagree with the today view.
 */
export function buildWeeklyCompletion(
  definitions: HabitDefinitionDto[],
  logs: HabitLogDto[],
  days = 7,
  endDate = todayLocalDate(),
): { date: string; value: number }[] {
  const [year, month, day] = endDate.split("-").map(Number);
  return Array.from({ length: days }, (_, i) => {
    const date = toLocalDateString(new Date(year, month - 1, day - (days - 1 - i)));
    return { date, value: buildTodayDashboard(definitions, logs, date).completionPercent };
  });
}

export { todayLocalDate };
