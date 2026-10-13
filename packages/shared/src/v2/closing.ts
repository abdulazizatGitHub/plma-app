import { buildDay, type DayEntry } from "./day.js";
import type { Item, Occurrence } from "./entities.js";
import { occurrenceIdFor } from "./occurrence-id.js";
import { entryState } from "./progress.js";

/*
 * Closing a day (FLX-06, owner 2026-10-13). When a day's correction window
 * ends, every required repeating item still open is written down as missed.
 * From then on that day is read from its stored rows only, so changing an
 * item's schedule later can't erase (or invent) a missed day.
 *
 * One-off tasks are left alone: an unfinished one is "overdue" and can still
 * be moved to today; a stored "missed" row would move with it.
 */

const repeating = (i: Item) => i.schedule.kind !== "once";

/** The `missed` rows to store for `date`: open, required, repeating units with no row yet. */
export async function closeDay(items: Item[], occurrences: Occurrence[], date: string, userId: string, now: string): Promise<Occurrence[]> {
  const out: Occurrence[] = [];
  for (const e of buildDay(items, occurrences, date)) {
    for (const unit of e.children ?? [e]) {
      if (unit.occurrence || unit.item.isOptional || !repeating(unit.item)) continue;
      if (entryState(unit) !== "todo") continue;
      out.push({
        id: await occurrenceIdFor(unit.item.id, date, unit.slot),
        userId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        itemId: unit.item.id,
        date,
        slot: unit.slot,
        status: "missed",
        value: null,
        detail: { closed: true },
        movedTo: null,
        movedFrom: null,
        startedAt: null,
        completedAt: null,
        deviceId: "server",
      });
    }
  }
  return out;
}

/**
 * A day as history sees it. On a closed day, repeating items without a stored
 * row weren't due when the day closed, so they're dropped (a schedule edit
 * made afterwards can't add or remove them). Open days are built live.
 */
export function historyDay(items: Item[], occurrences: Occurrence[], date: string, closed: boolean): DayEntry[] {
  const day = buildDay(items, occurrences, date);
  if (!closed) return day;
  const keep = (u: DayEntry) => !!u.occurrence || !repeating(u.item);
  return day.flatMap((e) => {
    if (!e.children) return keep(e) ? [e] : [];
    const children = e.children.filter(keep);
    return children.length ? [{ ...e, children }] : [];
  });
}
