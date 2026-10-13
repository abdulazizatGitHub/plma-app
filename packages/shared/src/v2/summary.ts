import { toLocalDateString } from "../date.js";
import { historyDay } from "./closing.js";
import type { DayEntry } from "./day.js";
import type { Category, Item, Occurrence } from "./entities.js";
import { dateRange } from "./history.js";
import { entryState } from "./progress.js";

/*
 * Week and month summaries (HIS-02/03, owner 2026-10-13). Rules:
 *  - only finished days (before today) with something due count in averages
 *    and rates; days with nothing due are "free", today is "so far"
 *  - optional items never count; skipped and moved are neutral
 *  - a past item not done (or only started) is missed
 *  - qada counts as done; late fixes count as done and are reported
 *  - closed days are read from their stored rows only (see closing.ts)
 *  - per-category numbers use each item's current category
 */

export type SummaryDay = {
  date: string;
  /** Required units that day (0 = free day). */
  required: number;
  done: number;
  /** 0–100; null for free days and future days. */
  pct: number | null;
  kind: "past" | "today" | "future";
};

export type Tally = { done: number; missed: number; skipped: number; moved: number; late: number; qada: number };

export type ItemTally = Tally & { item: Item; due: number; rate: number | null };

export type CategoryTally = Tally & {
  category: Category | null;
  due: number;
  rate: number | null;
  best: ItemTally | null;
  worst: ItemTally | null;
};

export type PeriodSummary = {
  from: string;
  to: string;
  days: SummaryDay[];
  /** Average % of finished days with something due; null when there were none. */
  average: number | null;
  perfectDays: number;
  /** Finished days with something due. */
  countedDays: number;
  totals: Tally;
  /** Today's % so far, when today is in the period. */
  todaySoFar: number | null;
  byCategory: CategoryTally[];
  doingWell: CategoryTally[];
  needsAttention: (CategoryTally & { mostMissed: ItemTally | null })[];
};

export type SummaryInput = { items: Item[]; occurrences: Occurrence[]; categories: Category[] };
export type SummaryOptions = { from: string; to: string; today: string; closedThrough?: string | null };

const empty = (): Tally => ({ done: 0, missed: 0, skipped: 0, moved: 0, late: 0, qada: 0 });
const rate = (done: number, due: number) => (due ? Math.round((done / due) * 100) : null);
/** At least this many due units before a category or item is called out. */
export const INSIGHT_MIN_DUE = 5;

export function periodSummary(input: SummaryInput, opts: SummaryOptions): PeriodSummary {
  const { items, occurrences, categories } = input;
  const { from, to, today, closedThrough = null } = opts;
  const byId = new Map(items.map((i) => [i.id, i]));
  const cats = new Map(categories.map((c) => [c.id, c]));
  const occByDate = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    if (!o.date || o.deletedAt) continue;
    occByDate.set(o.date, [...(occByDate.get(o.date) ?? []), o]);
  }
  const categoryOf = (it: Item) => it.categoryId ?? (it.parentId ? (byId.get(it.parentId)?.categoryId ?? null) : null);

  const totals = empty();
  const perCat = new Map<string, Tally & { due: number }>();
  const perItem = new Map<string, Tally & { due: number }>();
  const bump = (map: Map<string, Tally & { due: number }>, key: string, f: (t: Tally & { due: number }) => void) => {
    const t = map.get(key) ?? { ...empty(), due: 0 };
    f(t);
    map.set(key, t);
  };

  const days: SummaryDay[] = dateRange(from, to).map((date) => {
    if (date > today) return { date, required: 0, done: 0, pct: null, kind: "future" };
    const closed = !!closedThrough && date <= closedThrough;
    const units = historyDay(items, occByDate.get(date) ?? [], date, closed).flatMap((e: DayEntry) => e.children ?? [e]);
    let required = 0;
    let done = 0;
    const past = date < today;
    for (const u of units) {
      if (u.item.isOptional) continue;
      const state = entryState(u);
      const o = u.occurrence;
      const catKey = categoryOf(u.item) ?? "none";
      if (state === "not_today") {
        const which = o?.status === "moved" ? "moved" : "skipped";
        if (past) {
          totals[which] += 1;
          bump(perCat, catKey, (t) => (t[which] += 1));
          bump(perItem, u.item.id, (t) => (t[which] += 1));
        }
        continue;
      }
      required += 1;
      const isDone = state === "done";
      if (isDone) done += 1;
      if (!past) continue; // today: only the "so far" %
      const late = isDone && o?.detail?.late === true;
      const qada = isDone && o?.detail?.qada === true;
      const apply = (t: Tally & { due?: number }) => {
        if (isDone) t.done += 1;
        else t.missed += 1;
        if (late) t.late += 1;
        if (qada) t.qada += 1;
      };
      apply(totals);
      bump(perCat, catKey, (t) => {
        t.due += 1;
        apply(t);
      });
      bump(perItem, u.item.id, (t) => {
        t.due += 1;
        apply(t);
      });
    }
    return { date, required, done, pct: required ? Math.round((done / required) * 100) : null, kind: date === today ? "today" : "past" };
  });

  const counted = days.filter((d) => d.kind === "past" && d.pct !== null);
  const average = counted.length ? Math.round(counted.reduce((n, d) => n + (d.pct ?? 0), 0) / counted.length) : null;
  const todayDay = days.find((d) => d.kind === "today");

  const itemTally = (id: string): ItemTally | null => {
    const t = perItem.get(id);
    const item = byId.get(id);
    return t && item ? { ...t, item, rate: rate(t.done, t.due) } : null;
  };
  const byCategory: CategoryTally[] = [...perCat.entries()]
    .map(([key, t]) => {
      const its = [...perItem.keys()]
        .map(itemTally)
        .filter((x): x is ItemTally => !!x && (categoryOf(x.item) ?? "none") === key && x.due >= 2);
      const sorted = [...its].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || b.due - a.due);
      return {
        ...t,
        category: key === "none" ? null : (cats.get(key) ?? null),
        rate: rate(t.done, t.due),
        best: sorted[0] ?? null,
        worst: sorted.length > 1 ? (sorted.at(-1) ?? null) : null,
      };
    })
    .filter((c) => c.due || c.skipped || c.moved)
    .sort((a, b) => (b.due - a.due) || (a.category?.sortOrder ?? 999) - (b.category?.sortOrder ?? 999));

  const doingWell = byCategory.filter((c) => c.due >= INSIGHT_MIN_DUE && (c.rate ?? 0) >= 80);
  const needsAttention = byCategory
    .filter((c) => c.due >= INSIGHT_MIN_DUE && (c.rate ?? 100) <= 50)
    .map((c) => {
      const missedMost = [...perItem.keys()]
        .map(itemTally)
        .filter((x): x is ItemTally => !!x && (categoryOf(x.item) ?? "none") === (c.category?.id ?? "none") && x.missed > 0)
        .sort((a, b) => b.missed - a.missed)[0];
      return { ...c, mostMissed: missedMost ?? null };
    });

  return {
    from,
    to,
    days,
    average,
    perfectDays: counted.filter((d) => d.pct === 100).length,
    countedDays: counted.length,
    totals,
    todaySoFar: todayDay ? todayDay.pct : null,
    byCategory,
    doingWell,
    needsAttention,
  };
}

/** The first day of the week holding `date` (weekStart: 0 = Sunday … 6). */
export function periodWeek(date: string, weekStart = 1): { from: string; to: string } {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const back = (dow - weekStart + 7) % 7;
  const start = new Date(Date.UTC(y, m - 1, d - back));
  const end = new Date(Date.UTC(y, m - 1, d - back + 6));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

/** The calendar month holding `date`. */
export function periodMonth(date: string): { from: string; to: string } {
  const [y, m] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${date.slice(0, 7)}-01`, to: `${date.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

/** The same kind of period just before this one (for the trend). */
export function previousPeriod(p: { from: string; to: string }, kind: "week" | "month"): { from: string; to: string } {
  if (kind === "month") {
    const [y, m] = p.from.split("-").map(Number);
    return periodMonth(toLocalDateString(new Date(y, m - 2, 15)));
  }
  const [y, m, d] = p.from.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d - 7));
  const end = new Date(Date.UTC(y, m - 1, d - 1));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
