import { historyDay } from "./closing.js";
import type { Item, Occurrence, PRIORITIES } from "./entities.js";
import { dateRange } from "./history.js";
import { prayerKeyOf } from "./prayer/prayer-set.js";
import { normalisePrayerKey } from "./prayer/windows.js";
import { entryState } from "./progress.js";
import { afterClose, dayRings, type RingSettings } from "./rings.js";
import { periodWeek } from "./summary.js";
import type { AwardProgress, Challenge } from "./awards.js";

type Priority = (typeof PRIORITIES)[number];

/*
 * Motivation (Phase 8, REW-01…04, owner 2026-10-14; rings 2026-10-15). Rewards
 * are never counted from events: each day is scored from its stored entries,
 * so re-syncing, replaying or toggling can't change a total. Rules:
 *  - a done item earns by priority (low 1, medium 2, high 3, critical 5);
 *    qada earns half (rounded up); a late fix earns nothing; going past the
 *    goal earns nothing extra; optional items earn too (a bonus)
 *  - a complete day closes every ring that applies (see rings.ts); a perfect
 *    day is complete with no late fixes, and earns +10
 *  - levels: level n starts at 50·n·(n−1) points
 *  - the day streak counts complete days; free days are neutral
 *  - freezes: 1 per 7 streak days, at most 2; a closed day that wasn't
 *    complete uses one and the streak carries on; with none, it restarts
 *  - today and the fixable days never break a streak, and add to it once complete
 */

export const PRIORITY_POINTS: Record<Priority, number> = { low: 1, medium: 2, high: 3, critical: 5 };
export const PERFECT_DAY_BONUS = 10;
export const FREEZE_EVERY = 7;
export const MAX_FREEZES = 2;

export type RewardSettings = RingSettings;

/** A scored day, as stored server-side (one row per user and day). */
export type RewardDay = {
  date: string;
  /** Units the rings count that day (0 = free day). */
  due: number;
  done: number;
  /** Every ring that applies closed: extends the streak. */
  complete: boolean;
  /** Complete with no late fixes: earns the bonus. */
  perfect: boolean;
  /** Item points plus any bonus. */
  points: number;
  prayerDue: number;
  /** In halves: on time 2, qada 1. */
  prayerFill: number;
  prayerClosed: boolean;
  commitDue: number;
  commitDone: number;
  commitClosed: boolean;
  balanceDue: number;
  balanceDone: number;
  balanceClosed: boolean;
  prayersOnTime: number;
  itemsDone: number;
  /** Zuhr (Jumu'ah on Fridays) prayed; null if not due. */
  dhuhr: boolean | null;
};

const late = (o: Occurrence | null | undefined) => o?.detail?.late === true;
const qada = (o: Occurrence | null | undefined) => o?.detail?.qada === true;

/** Points one completed entry earns (0 if it isn't done). The app uses this for the "+3" pop. */
export function unitPoints(item: Pick<Item, "priority">, occurrence: Occurrence | null | undefined, done: boolean): number {
  if (!done || !occurrence || late(occurrence)) return 0;
  const base = PRIORITY_POINTS[item.priority] ?? 0;
  return qada(occurrence) ? Math.ceil(base / 2) : base;
}

/** Scores one day from its entries. `closed` days are read from stored rows only (see closing.ts). */
export function scoreDay(items: Item[], occurrences: Occurrence[], date: string, closed: boolean, s: RewardSettings): RewardDay {
  const entries = historyDay(items, occurrences, date, closed);
  const rings = dayRings(entries, date, closed, s);
  let points = 0;
  let dhuhr: boolean | null = null;
  for (const u of entries.flatMap((e) => e.children ?? [e])) {
    const state = entryState(u);
    if (state === "not_today") continue;
    const done = state === "done";
    points += unitPoints(u.item, u.occurrence, done);
    if (u.item.parentId && normalisePrayerKey(prayerKeyOf(u.item) ?? "") === "dhuhr") dhuhr = done && !!u.occurrence && !afterClose(u.occurrence, date, s);
  }
  const p = rings.prayer;
  const c = rings.commit;
  const b = rings.balance;
  return {
    date,
    due: (p?.due ?? 0) + (c?.due ?? 0) + (b?.due ?? 0),
    done: rings.itemsDone,
    complete: rings.complete,
    perfect: rings.perfect,
    points: points + (rings.perfect ? PERFECT_DAY_BONUS : 0),
    prayerDue: p?.due ?? 0,
    prayerFill: Math.round((p?.fill ?? 0) * 2),
    prayerClosed: !!p?.closed,
    commitDue: c?.due ?? 0,
    commitDone: c ? c.segments.filter((x) => x === "done").length : 0,
    commitClosed: !!c?.closed,
    balanceDue: b?.due ?? 0,
    balanceDone: b?.fill ?? 0,
    balanceClosed: !!b?.closed,
    prayersOnTime: rings.prayersOnTime,
    itemsDone: rings.itemsDone,
    dhuhr,
  };
}

/* ---------- levels ---------- */

export const levelStart = (n: number) => 50 * n * (n - 1);

export function levelOf(points: number): { level: number; start: number; next: number } {
  let n = 1;
  while (levelStart(n + 1) <= points) n += 1;
  return { level: n, start: levelStart(n), next: levelStart(n + 1) };
}

/* ---------- streak ---------- */

export type StreakState = {
  /** The streak as of the last closed day, plus today and the fixable days once complete. */
  current: number;
  best: number;
  freezes: number;
  /** Closed days a freeze covered (newest last). */
  freezeUsedOn: string[];
  /** Closed days the streak restarted after (no freeze left). */
  restartedAfter: string[];
  /** Complete open days added on top of the closed streak. */
  provisional: number;
};

const nextDay = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/** Walks the scored days in order. Missing days are free. */
export function streakOf(days: RewardDay[], closedThrough: string | null, today: string): StreakState {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let run = 0;
  let best = 0;
  let freezes = 0;
  const freezeUsedOn: string[] = [];
  const restartedAfter: string[] = [];
  for (const d of sorted) {
    if (!closedThrough || d.date > closedThrough) break;
    if (d.due === 0) continue;
    if (d.complete) {
      run += 1;
      best = Math.max(best, run);
      if (run % FREEZE_EVERY === 0 && freezes < MAX_FREEZES) freezes += 1;
    } else if (freezes > 0 && run > 0) {
      freezes -= 1;
      freezeUsedOn.push(d.date);
    } else {
      if (run > 0) restartedAfter.push(d.date);
      run = 0;
    }
  }
  // Open days: complete ones add on, unfinished ones don't break anything yet.
  let provisional = 0;
  const start = closedThrough ? nextDay(closedThrough) : sorted[0]?.date;
  if (start && start <= today) {
    const byDate = new Map(sorted.map((d) => [d.date, d]));
    for (const date of dateRange(start, today)) if (byDate.get(date)?.complete) provisional += 1;
  }
  const current = run + provisional;
  return { current, best: Math.max(best, current), freezes, freezeUsedOn, restartedAfter, provisional };
}

/* ---------- summary ---------- */

export type RewardsSummary = {
  points: number;
  level: number;
  levelStart: number;
  nextLevelAt: number;
  todayPoints: number;
  weekPoints: number;
  streak: StreakState;
};

/** GET /v1/rewards. */
export type RewardsPayload = RewardsSummary & {
  today: string;
  /** Awards earned (stored), newest last; `seen` = celebrated. */
  badges: { id: string; earnedAt: string; seen: boolean }[];
  /** Every award that can show now: earned or not, with progress. */
  awards: AwardProgress[];
  /** The last 7 days, oldest first, for the rings strip. */
  week: RewardDay[];
  challenge: (Challenge & { closed: number; daysLeft: number }) | null;
  hijriOffset: number;
};

export function rewardsSummary(days: RewardDay[], opts: { closedThrough: string | null; today: string; weekStart: number }): RewardsSummary {
  const points = days.reduce((n, d) => n + d.points, 0);
  const { level, start, next } = levelOf(points);
  const week = periodWeek(opts.today, opts.weekStart);
  return {
    points,
    level,
    levelStart: start,
    nextLevelAt: next,
    todayPoints: days.find((d) => d.date === opts.today)?.points ?? 0,
    weekPoints: days.filter((d) => d.date >= week.from && d.date <= week.to).reduce((n, d) => n + d.points, 0),
    streak: streakOf(days, opts.closedThrough, opts.today),
  };
}
