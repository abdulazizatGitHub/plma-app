import { toLocalDateString } from "../date.js";
import { historyDay } from "./closing.js";
import { MOVED_SLOT_PREFIX } from "./day.js";
import type { Item, Occurrence } from "./entities.js";
import { entryState } from "./progress.js";
import { daysBetween } from "./schedule.js";

/*
 * Basic per-item history (Phase 3, HIS-01): a mark per day, completion rate and
 * streaks. Rules:
 *   - a day counts only if the item was due (and existed, and wasn't archived yet)
 *   - skipped / moved days neither break nor extend a streak
 *   - today, unfinished, doesn't break the current streak
 *   - partial (started, not finished) on a past day counts as not done
 */

export type DayMark = "done" | "partial" | "missed" | "skipped" | "today" | "not_due" | "future";

/** One line of an item's log (newest first in `log`). */
export type LogEntry = {
  date: string;
  mark: DayMark;
  /** "moved" when the skip was a move. */
  how?: "moved";
  value: number | null;
  /** The target it was logged against. */
  target: number | null;
  /** Logged during the correction window. */
  late: boolean;
  /** Prayed late. */
  qada: boolean;
  movedTo: string | null;
};

export type ItemHistory = {
  days: { date: string; mark: DayMark }[];
  /** Due days, newest first, with what happened. */
  log: LogEntry[];
  skipped: number;
  moved: number;
  /** Due days so far that were done. */
  done: number;
  /** Due days so far that count (done + missed + partial, plus today once done). */
  counted: number;
  /** 0–100, rounded; null when nothing has been due yet. */
  completionRate: number | null;
  currentStreak: number;
  bestStreak: number;
};

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Every date from `from` to `to`, inclusive. */
export function dateRange(from: string, to: string): string[] {
  const n = daysBetween(from, to);
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => addDays(from, i));
}

/**
 * History of one item over [from, to]. `children` are a routine's sub-items;
 * `occurrences` must include theirs too.
 */
export function itemHistory(
  item: Item,
  children: Item[],
  occurrences: Occurrence[],
  from: string,
  to: string,
  today: string,
  /** Days up to here are closed: read from stored rows only. */
  closedThrough: string | null = null,
): ItemHistory {
  // History ignores the archive flag (it only stops future days).
  const revive = (i: Item): Item => ({ ...i, archivedAt: null });
  const pool = [revive(item), ...children.filter((c) => c.parentId === item.id && !c.deletedAt).map(revive)];
  const born = toLocalDateString(new Date(item.createdAt));
  const archived = item.archivedAt ? toLocalDateString(new Date(item.archivedAt)) : null;
  const byDate = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    if (!o.date || o.deletedAt) continue;
    const list = byDate.get(o.date) ?? [];
    list.push(o);
    byDate.set(o.date, list);
  }

  const log: LogEntry[] = [];
  let skipped = 0;
  let moved = 0;
  const days = dateRange(from, to).map((date): { date: string; mark: DayMark } => {
    if (date > today) return { date, mark: "future" };
    if (date < born || (archived && date > archived)) return { date, mark: "not_due" };
    const closed = !!closedThrough && date <= closedThrough;
    const entry = historyDay(pool, byDate.get(date) ?? [], date, closed).find((e) => e.item.id === item.id && !e.slot.startsWith(MOVED_SLOT_PREFIX));
    if (!entry) return { date, mark: "not_due" };
    const state = entryState(entry);
    const mark: DayMark =
      state === "done" ? "done" : state === "not_today" ? "skipped" : date === today ? "today" : state === "in_progress" ? "partial" : "missed";
    const o = entry.occurrence;
    const how = o?.status === "moved" ? "moved" : undefined;
    if (mark === "skipped") {
      if (how) moved += 1;
      else skipped += 1;
    }
    const t = item.tracking;
    const snap = o?.detail?.target;
    log.push({
      date,
      mark,
      how,
      value: o?.value ?? null,
      target: typeof snap === "number" ? snap : t.kind === "quantity" ? (t.target ?? null) : t.kind === "duration" ? (t.targetMin ?? null) : null,
      late: o?.detail?.late === true,
      qada: o?.detail?.qada === true,
      movedTo: o?.movedTo ?? null,
    });
    return { date, mark };
  });

  let done = 0;
  let counted = 0;
  let run = 0;
  let bestStreak = 0;
  for (const { mark } of days) {
    if (mark === "done") {
      done += 1;
      counted += 1;
      run += 1;
      bestStreak = Math.max(bestStreak, run);
    } else if (mark === "missed" || mark === "partial") {
      counted += 1;
      run = 0;
    }
  }
  return {
    days,
    log: log.reverse(),
    skipped,
    moved,
    done,
    counted,
    completionRate: counted ? Math.round((done / counted) * 100) : null,
    currentStreak: run,
    bestStreak,
  };
}
