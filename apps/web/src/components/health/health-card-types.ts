import type { HabitDefinitionDto, HabitLogDto, HealthPeriod } from "@life/shared";

export type HealthCardProps = {
  def: HabitDefinitionDto;
  logs: HabitLogDto[];
  today: string;
  period: HealthPeriod;
  /** True while any health write is in flight — cards lock their controls. */
  busy: boolean;
  onLog: (def: HabitDefinitionDto, payload: Record<string, unknown>) => void;
  onGoal: (def: HabitDefinitionDto, patch: Record<string, unknown>) => void;
};

export function todayPayload(logs: HabitLogDto[], def: HabitDefinitionDto, today: string): unknown {
  return logs.find((l) => l.habitDefinitionId === def.id && l.logDate === today)?.payload;
}

/** A positive integer from a definition's config, or the fallback. */
export function numberConfig(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function periodLabel(period: HealthPeriod): string {
  return period === "week" ? "This week" : "This month";
}

/** 6240 → "6.2k", 12000 → "12k", 800 → "800". */
export function compactNumber(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
}

export const CHIP =
  "press-pop transition-token flex min-h-11 items-center justify-center gap-1.5 rounded-(--radius-control) px-3 text-sm font-semibold disabled:opacity-50";
export const CHIP_ON = "bg-ink text-canvas";
export const CHIP_OFF = "border border-line text-ink hover:bg-surface-sunken";
