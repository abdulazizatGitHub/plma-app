import type { DayEntry } from "./day.js";

/*
 * Status buckets and the day % (REQUIREMENTS_V2 TRK-05, FLX-04).
 *   required = not optional, not skipped/moved (pending tasks have no day)
 *   pct      = done ÷ required; nothing required → 100%
 * Group parents (Daily prayers) are not counted themselves; their children are.
 */

export type EntryState = "todo" | "in_progress" | "done" | "not_today";

export function entryState(entry: DayEntry): EntryState {
  if (entry.children) {
    const states = entry.children.map(entryState).filter((s) => s !== "not_today");
    if (!states.length) return "todo";
    if (states.every((s) => s === "done")) return "done";
    return states.some((s) => s !== "todo") ? "in_progress" : "todo";
  }
  const o = entry.occurrence;
  if (o?.status === "skipped" || o?.status === "moved") return "not_today";
  const t = entry.item.tracking;
  if (t.kind === "quantity" || t.kind === "duration") {
    const value = o?.value ?? 0;
    const target = t.kind === "quantity" ? t.target : t.targetMin;
    if (target !== undefined && value >= target) return "done";
    if (value > 0 && o?.status !== "done") return "in_progress";
  }
  if (t.kind === "checklist" && o?.status !== "done") {
    const saved = o?.detail?.steps;
    const ticked = Array.isArray(saved) ? t.steps.filter((_, i) => saved[i] === true).length : 0;
    if (ticked === t.steps.length) return "done";
    if (ticked > 0) return "in_progress";
  }
  if (o?.status === "done") return "done";
  if (o?.status === "in_progress") return "in_progress";
  return "todo";
}

export type DayProgress = {
  required: number;
  done: number;
  /** 0–100, rounded. 100 when nothing is required. */
  pct: number;
  /** Rows per bucket, for the status tiles (groups are shown as their own row type, not counted). */
  counts: Record<EntryState, number>;
};

export function dayProgress(entries: DayEntry[]): DayProgress {
  const units = entries.flatMap((e) => e.children ?? [e]);
  let required = 0;
  let done = 0;
  for (const u of units) {
    const state = entryState(u);
    if (state === "not_today" || u.item.isOptional) continue;
    required += 1;
    if (state === "done") done += 1;
  }
  const counts: Record<EntryState, number> = { todo: 0, in_progress: 0, done: 0, not_today: 0 };
  for (const e of entries) if (!e.children) counts[entryState(e)] += 1;
  return { required, done, pct: required ? Math.round((done / required) * 100) : 100, counts };
}
