import { buildDay, type DayEntry } from "../day.js";
import type { Item, Occurrence } from "../entities.js";
import { dateRange } from "../history.js";
import { prayerKeyOf } from "./prayer-set.js";

/*
 * Prayer status and insights (PRY-03, PRY-07…09).
 *  - prayed: done on time; qada: done late (`detail.qada`)
 *  - missed: marked missed, or still unmarked once its day has passed (derived
 *    at read time, so nothing has to run at midnight and it works offline)
 *  - open: today, not marked yet
 */

export type PrayerMark = "prayed" | "qada" | "missed" | "open";

export function prayerMark(entry: Pick<DayEntry, "occurrence">, date: string, today: string): PrayerMark {
  const o = entry.occurrence;
  if (o?.status === "done") return o.detail?.qada === true ? "qada" : "prayed";
  if (o?.status === "missed") return "missed";
  return date < today ? "missed" : "open";
}

export type PrayerInsightRow = {
  itemId: string;
  title: string;
  key: string | null;
  /** Days this prayer counted (today only once marked). */
  due: number;
  prayed: number;
  qada: number;
  missed: number;
  /** Prayed at all (on time or qada) ÷ due, 0–100. */
  rate: number;
  /** On time ÷ due, 0–100. */
  onTimeRate: number;
};

export type PrayerInsights = {
  rows: PrayerInsightRow[];
  totals: { due: number; prayed: number; qada: number; missed: number };
  mostMissed: PrayerInsightRow | null;
  mostConsistent: PrayerInsightRow | null;
  /** Consecutive days, back from today, with every prayer prayed on time (qada doesn't extend it). */
  onTimeStreak: number;
  /** Missed prayers still recoverable as qada, newest first. */
  missedList: { date: string; entry: DayEntry }[];
  suggestion: string;
};

const TIPS: Record<string, string> = {
  fajr: "Sleep a little earlier and set a Fajr alarm.",
  dhuhr: "Plan a short break at work or university for Zuhr.",
  asr: "Asr slips in the afternoon rush — a reminder helps.",
  maghrib: "Maghrib's window is short; pause what you're doing at sunset.",
  isha: "Pray Isha before winding down for the night.",
};

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/** Insights for the prayer block over [from, to] (to is usually today). */
export function prayerInsights(group: Item, children: Item[], occurrences: Occurrence[], from: string, to: string, today: string): PrayerInsights {
  const kids = children.filter((c) => c.parentId === group.id && !c.deletedAt);
  const pool = [{ ...group, archivedAt: null }, ...kids.map((k) => ({ ...k, archivedAt: null }))];
  const byDate = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    if (!o.date || o.deletedAt) continue;
    byDate.set(o.date, [...(byDate.get(o.date) ?? []), o]);
  }
  const rows = new Map<string, PrayerInsightRow>(
    kids.map((k) => [k.id, { itemId: k.id, title: k.title, key: prayerKeyOf(k), due: 0, prayed: 0, qada: 0, missed: 0, rate: 0, onTimeRate: 0 }]),
  );
  const perDay: { date: string; allOnTime: boolean; counted: boolean }[] = [];
  const missedList: PrayerInsights["missedList"] = [];

  for (const date of dateRange(from, to > today ? today : to)) {
    const group$ = buildDay(pool, byDate.get(date) ?? [], date).find((e) => e.item.id === group.id);
    let counted = false;
    let allOnTime = true;
    for (const child of group$?.children ?? []) {
      // A prayer added later doesn't count before it existed (unless it has a record then, e.g. migrated history).
      if (date < child.item.createdAt.slice(0, 10) && !child.occurrence) continue;
      const mark = prayerMark(child, date, today);
      if (mark === "open") {
        allOnTime = false;
        continue;
      }
      const row = rows.get(child.item.id);
      if (!row) continue;
      counted = true;
      row.due += 1;
      row[mark] += 1;
      if (mark !== "prayed") allOnTime = false;
      if (mark === "missed") missedList.push({ date, entry: child });
    }
    perDay.push({ date, allOnTime, counted });
  }

  const list = [...rows.values()].map((r) => ({ ...r, rate: pct(r.prayed + r.qada, r.due), onTimeRate: pct(r.prayed, r.due) }));
  const totals = list.reduce((t, r) => ({ due: t.due + r.due, prayed: t.prayed + r.prayed, qada: t.qada + r.qada, missed: t.missed + r.missed }), { due: 0, prayed: 0, qada: 0, missed: 0 });
  const withData = list.filter((r) => r.due > 0);
  const mostMissed = withData.filter((r) => r.missed > 0).sort((a, b) => b.missed - a.missed || a.rate - b.rate)[0] ?? null;
  const mostConsistent = withData.length > 1 ? ([...withData].sort((a, b) => b.onTimeRate - a.onTimeRate || b.rate - a.rate)[0] ?? null) : null;

  let onTimeStreak = 0;
  for (const day of [...perDay].reverse()) {
    if (day.date === today && !day.allOnTime) continue; // today isn't over yet
    if (!day.counted || !day.allOnTime) break;
    onTimeStreak += 1;
  }

  let suggestion: string;
  if (!totals.due) suggestion = "Mark your prayers each day and your insights will appear here.";
  else if (!totals.missed && !totals.qada) suggestion = "MashaAllah — every prayer on time in this period. Keep it up.";
  else if (mostMissed) {
    suggestion = `${mostMissed.title} is your most missed prayer (${mostMissed.missed} of ${mostMissed.due}). ${TIPS[mostMissed.key ?? ""] ?? "A reminder for it can help."}`;
  } else suggestion = `You recovered ${totals.qada} as qada — try praying them on time next.`;
  if (mostMissed && totals.qada) suggestion += ` You've made up ${totals.qada} as qada.`;

  return { rows: list, totals, mostMissed, mostConsistent, onTimeStreak, missedList: missedList.reverse(), suggestion };
}
