import type { HabitDefinitionDto, HabitLogDto } from "@life/shared";
import { countPrayersByStatus, isFriday, isQuranLogDone, todayLocalDate } from "@life/shared";

export type DashboardRow = {
  key: string;
  label: string;
  value: string;
  done: boolean;
};

function defBySlug(defs: HabitDefinitionDto[], slug: string) {
  return defs.find((d) => d.slug === slug);
}

function logForDef(logs: HabitLogDto[], habitDefinitionId: string) {
  return logs.find((l) => l.habitDefinitionId === habitDefinitionId);
}

function prayerSummary(defs: HabitDefinitionDto[], logs: HabitLogDto[]) {
  const def = defBySlug(defs, "prayer");
  if (!def) return { value: "—", done: false, completed: 0, total: 5 };
  const log = logForDef(logs, def.id);
  const counts = countPrayersByStatus(log?.payload);
  return {
    value: `${counts.completed}/5`,
    done: counts.completed === 5,
    completed: counts.completed,
    total: 5,
  };
}

function quranSummary(defs: HabitDefinitionDto[], logs: HabitLogDto[], date: string) {
  const mulk = defBySlug(defs, "quran-mulk");
  const kahf = defBySlug(defs, "quran-kahf");
  const friday = isFriday(date);
  let done = 0;
  let total = 0;

  if (mulk) {
    total += 1;
    if (isQuranLogDone(logForDef(logs, mulk.id)?.payload)) done += 1;
  }
  if (kahf && friday) {
    total += 1;
    if (isQuranLogDone(logForDef(logs, kahf.id)?.payload)) done += 1;
  }

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
  };
}

function counterSummary(
  def: HabitDefinitionDto | undefined,
  logs: HabitLogDto[],
  fallbackGoal: number,
  unitLabel: string,
) {
  if (!def) return { value: "—", done: false, completed: 0, total: 1 };
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
  };
}

function booleanSummary(
  def: HabitDefinitionDto | undefined,
  logs: HabitLogDto[],
  labelDone = "Completed",
  labelPending = "Pending",
) {
  if (!def) return { value: "—", done: false, completed: 0, total: 1 };
  const log = logForDef(logs, def.id);
  const completed = log?.payload?.completed === true;
  return {
    value: completed ? labelDone : labelPending,
    done: completed,
    completed: completed ? 1 : 0,
    total: 1,
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
  const exercise = booleanSummary(
    defBySlug(definitions, "exercise"),
    dayLogs,
  );
  const makeBed = booleanSummary(
    defBySlug(definitions, "make-bed"),
    dayLogs,
  );
  const noPhone = booleanSummary(
    defBySlug(definitions, "no-phone-hour"),
    dayLogs,
  );

  const rows: DashboardRow[] = [
    { key: "prayer", label: "Prayer", value: prayer.value, done: prayer.done },
    { key: "quran", label: "Quran", value: quran.value, done: quran.done },
    { key: "steps", label: "Steps", value: steps.value, done: steps.done },
    { key: "water", label: "Water", value: water.value, done: water.done },
    {
      key: "exercise",
      label: "Exercise",
      value: exercise.value,
      done: exercise.done,
    },
    {
      key: "reading",
      label: "Reading",
      value: "Pending",
      done: false,
    },
    { key: "study", label: "Study", value: "0m", done: false },
    {
      key: "make-bed",
      label: "Make bed",
      value: makeBed.value,
      done: makeBed.done,
    },
    {
      key: "no-phone",
      label: "No phone",
      value: noPhone.value,
      done: noPhone.done,
    },
  ];

  const tracked = [
    prayer,
    quran,
    steps,
    water,
    exercise,
    makeBed,
    noPhone,
  ];
  const completedUnits = tracked.reduce((s, t) => s + t.completed, 0);
  const totalUnits = tracked.reduce((s, t) => s + t.total, 0);
  const completionPercent =
    totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

  return { rows, completionPercent };
}

export { todayLocalDate };
