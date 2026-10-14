import { historyDay } from "./closing.js";
import { LOG_GRACE_DAYS, editLag } from "./day-access.js";
import type { DayEntry } from "./day.js";
import type { Item, Occurrence, PRIORITIES } from "./entities.js";

type Priority = (typeof PRIORITIES)[number];
import { dateRange } from "./history.js";
import { prayerKeyOf } from "./prayer/prayer-set.js";
import { FARD_KEYS, normalisePrayerKey } from "./prayer/windows.js";
import { entryState } from "./progress.js";
import { periodWeek } from "./summary.js";

/*
 * Motivation (Phase 8, REW-01…04, owner 2026-10-14). Rewards are never counted
 * from events: each day is scored from its stored entries, so re-syncing,
 * replaying or toggling can't change a total. Rules:
 *  - a done item earns by priority (low 1, medium 2, high 3, critical 5);
 *    qada earns half (rounded up); a late fix earns nothing; going past the
 *    goal earns nothing extra; optional items earn too (a bonus)
 *  - a perfect day (every required item done, none of it a late fix) +10
 *  - levels: level n starts at 50·n·(n−1) points
 *  - the day streak counts complete days (late fixes in the window count, a
 *    prayer recovered after the day closed doesn't); free days are neutral
 *  - freezes: 1 per 7 streak days, at most 2; a closed day that wasn't
 *    complete uses one and the streak carries on; with none, it restarts
 *  - today and the fixable days never break a streak, and add to it once complete
 */

export const PRIORITY_POINTS: Record<Priority, number> = { low: 1, medium: 2, high: 3, critical: 5 };
export const PERFECT_DAY_BONUS = 10;
export const FREEZE_EVERY = 7;
export const MAX_FREEZES = 2;

export type RewardSettings = { timezone: string; dayEndHour: number };

/** A scored day, as stored server-side (one row per user and day). */
export type RewardDay = {
  date: string;
  /** Required units that day (0 = free day). */
  due: number;
  done: number;
  /** Every required unit done (late fixes in the window count): extends the streak. */
  complete: boolean;
  /** Complete with no late fixes: earns the bonus. */
  perfect: boolean;
  /** Every fard prayer prayed (on time or qada); null when no prayers were due. */
  allPrayers: boolean | null;
  /** Item points plus any bonus. */
  points: number;
};

const late = (o: Occurrence | null | undefined) => o?.detail?.late === true;
const qada = (o: Occurrence | null | undefined) => o?.detail?.qada === true;

/** Points one completed entry earns (0 if it isn't done). The app uses this for the "+3" pop. */
export function unitPoints(item: Pick<Item, "priority">, occurrence: Occurrence | null | undefined, done: boolean): number {
  if (!done || !occurrence || late(occurrence)) return 0;
  const base = PRIORITY_POINTS[item.priority] ?? 0;
  return qada(occurrence) ? Math.ceil(base / 2) : base;
}

/** Marked after the day closed (only a prayer recovered as qada can be): counts in history, not for streaks. */
function afterClose(o: Occurrence, date: string, s: RewardSettings) {
  return late(o) && editLag(date, new Date(o.updatedAt), s.timezone, s.dayEndHour) > LOG_GRACE_DAYS;
}

const FARD = new Set<string>(FARD_KEYS);

/** Scores one day from its entries. `closed` days are read from stored rows only (see closing.ts). */
export function scoreDay(items: Item[], occurrences: Occurrence[], date: string, closed: boolean, s: RewardSettings): RewardDay {
  const units = historyDay(items, occurrences, date, closed).flatMap((e: DayEntry) => e.children ?? [e]);
  let due = 0;
  let done = 0;
  let counted = 0;
  let anyLate = false;
  let points = 0;
  let prayersDue = 0;
  let prayersDone = 0;
  for (const u of units) {
    const state = entryState(u);
    if (state === "not_today") continue;
    const isDone = state === "done";
    const o = u.occurrence;
    points += unitPoints(u.item, o, isDone);
    const counts = isDone && !!o && !afterClose(o, date, s);
    const key = normalisePrayerKey(prayerKeyOf(u.item) ?? "");
    if (FARD.has(key) && u.item.parentId) {
      prayersDue += 1;
      if (counts) prayersDone += 1;
    }
    if (u.item.isOptional) continue;
    due += 1;
    if (isDone) done += 1;
    if (counts) counted += 1;
    if (isDone && late(o)) anyLate = true;
  }
  const complete = due > 0 && counted === due;
  const perfect = complete && done === due && !anyLate;
  return {
    date,
    due,
    done,
    complete,
    perfect,
    allPrayers: prayersDue ? prayersDone === prayersDue : null,
    points: points + (perfect ? PERFECT_DAY_BONUS : 0),
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

/* ---------- badges ---------- */

export type BadgeId = "streak_3" | "streak_7" | "streak_30" | "streak_100" | "prayers_week" | "perfect_week" | "first_plan";

export type BadgeDef = { id: BadgeId; title: string; description: string; icon: "flame" | "moon" | "star" | "flag" };

export const BADGES: BadgeDef[] = [
  { id: "streak_3", title: "3-day streak", description: "Three complete days in a row.", icon: "flame" },
  { id: "streak_7", title: "7-day streak", description: "You kept it going a whole week.", icon: "flame" },
  { id: "streak_30", title: "30-day streak", description: "A month of complete days.", icon: "flame" },
  { id: "streak_100", title: "100-day streak", description: "A hundred complete days.", icon: "flame" },
  { id: "prayers_week", title: "A week of prayers", description: "Every prayer prayed, seven days running.", icon: "moon" },
  { id: "perfect_week", title: "Perfect week", description: "Every day of a week perfect (at least 5 with something due).", icon: "star" },
  { id: "first_plan", title: "First plan finished", description: "Every step of a plan done.", icon: "flag" },
];

const STREAK_BADGES: [BadgeId, number][] = [
  ["streak_3", 3],
  ["streak_7", 7],
  ["streak_30", 30],
  ["streak_100", 100],
];

export type BadgeProgress = { id: BadgeId; earned: boolean; have?: number; need?: number };

/**
 * Which badges the closed history has earned (streaks count closed days only,
 * so an unfinished today can't award one), with progress for the locked ones.
 */
export function badgeProgress(days: RewardDay[], closedThrough: string | null, opts: { weekStart: number; plansFinished: number }): BadgeProgress[] {
  const closed = days.filter((d) => !!closedThrough && d.date <= closedThrough).sort((a, b) => a.date.localeCompare(b.date));
  const s = streakOf(closed, closedThrough, closedThrough ?? "");
  const out: BadgeProgress[] = STREAK_BADGES.map(([id, need]) => ({ id, earned: s.best >= need, have: Math.min(s.current, need), need }));

  // Prayers: consecutive closed days with every fard prayer prayed (free days don't break it).
  let run = 0;
  let bestRun = 0;
  for (const d of closed) {
    if (d.allPrayers === null) continue;
    run = d.allPrayers ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
  }
  out.push({ id: "prayers_week", earned: bestRun >= 7, have: Math.min(run, 7), need: 7 });

  // Perfect week: a whole calendar week closed, every day perfect or free, at least 5 due.
  const weeks = new Map<string, RewardDay[]>();
  for (const d of closed) {
    const w = periodWeek(d.date, opts.weekStart);
    weeks.set(w.from, [...(weeks.get(w.from) ?? []), d]);
  }
  const perfectWeek = [...weeks.entries()].some(([from, ds]) => {
    const to = periodWeek(from, opts.weekStart).to;
    if (!closedThrough || to > closedThrough) return false;
    const dueDays = ds.filter((d) => d.due > 0);
    return dueDays.length >= 5 && dueDays.every((d) => d.perfect);
  });
  out.push({ id: "perfect_week", earned: perfectWeek });
  out.push({ id: "first_plan", earned: opts.plansFinished > 0 });
  return out;
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
  badges: { id: string; earnedAt: string; seen: boolean }[];
  progress: BadgeProgress[];
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
