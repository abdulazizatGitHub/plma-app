import { buildDay } from "./day.js";
import type { Item, Occurrence } from "./entities.js";
import { dateRange } from "./history.js";
import { dayProgress } from "./progress.js";

/*
 * Perfect-day streak for the Today card: consecutive days, back from today,
 * where everything required was done (the day's 100%). Today counts once it's
 * complete; an unfinished today doesn't break the streak (it isn't over yet).
 * Days with nothing due neither extend nor break it.
 */

export type DayStreak = { current: number; best: number };

export function dayStreak(items: Item[], occurrences: Occurrence[], from: string, today: string): DayStreak {
  const byDate = new Map<string, Occurrence[]>();
  for (const o of occurrences) if (o.date && !o.deletedAt) byDate.set(o.date, [...(byDate.get(o.date) ?? []), o]);
  let run = 0;
  let best = 0;
  let current = 0;
  for (const date of dateRange(from, today)) {
    const p = dayProgress(buildDay(items, byDate.get(date) ?? [], date));
    if (p.required === 0) continue; // nothing due: neutral
    if (p.pct === 100) {
      run += 1;
      best = Math.max(best, run);
    } else if (date !== today) run = 0;
    current = run;
  }
  return { current, best };
}
