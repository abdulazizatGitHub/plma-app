import type { Item, Occurrence } from "./entities.js";
import { toLocalDateString } from "../date.js";
import { isDueOn, isPending } from "./schedule.js";

/*
 * Builds one day's view (SYSTEM_DESIGN §5.1). An entry is an item due that day
 * plus its stored occurrence, if any. Occurrences stay *virtual* (null) until
 * the user touches them; stored ones always win.
 */

export const MOVED_SLOT_PREFIX = "moved:";

export type DayEntry = {
  /** Stable React key: item id + slot. */
  key: string;
  item: Item;
  slot: string;
  occurrence: Occurrence | null;
  /** Prayer-style groups: their children, each with its own occurrence. */
  children?: DayEntry[];
  /** For a plan step: the plan it belongs to (shown as context on Today). */
  plan?: Item;
};

const live = (o: Occurrence) => !o.deletedAt;

export function buildDay(items: Item[], occurrences: Occurrence[], date: string): DayEntry[] {
  const liveItems = items.filter((i) => !i.deletedAt && !i.archivedAt);
  const byId = new Map(liveItems.map((i) => [i.id, i]));
  const occ = new Map<string, Occurrence>();
  for (const o of occurrences) if (live(o) && o.date === date) occ.set(`${o.itemId}|${o.slot}`, o);

  // A repeating item doesn't exist on days before it was created (unless it has a record then,
  // e.g. history migrated from v1), so it can't be "missed" there.
  const existed = (item: Item) => item.schedule.kind === "once" || date >= toLocalDateString(new Date(item.createdAt)) || occ.has(`${item.id}|`);
  const entry = (item: Item, slot = ""): DayEntry => ({
    key: `${item.id}|${slot}`,
    item,
    slot,
    occurrence: occ.get(`${item.id}|${slot}`) ?? null,
  });

  const entries: DayEntry[] = [];
  const seen = new Set<string>();
  const add = (e: DayEntry) => {
    if (seen.has(e.key)) return;
    seen.add(e.key);
    entries.push(e);
  };

  const sorted = [...liveItems].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  for (const item of sorted) {
    if (item.type === "plan") continue; // a plan is a container; its steps show on their dates
    const plan = item.parentId ? byId.get(item.parentId) : undefined;
    // Children render inside their parent, except plan steps (PLN-06), which stand alone.
    if (item.parentId && plan?.type !== "plan") continue;
    const touched = occ.has(`${item.id}|`);
    if (!isDueOn(item, date) && !touched) continue;
    if (!existed(item)) continue;
    const e = entry(item);
    if (plan) e.plan = plan;
    if (item.type === "group") {
      e.children = sorted.filter((c) => c.parentId === item.id && (isDueOn(c, date) || occ.has(`${c.id}|`)) && existed(c)).map((c) => entry(c));
    }
    add(e);
  }

  // Instances moved here from another day (slot "moved:<from>").
  for (const o of occ.values()) {
    if (!o.slot.startsWith(MOVED_SLOT_PREFIX)) continue;
    const item = byId.get(o.itemId);
    if (item) add(entry(item, o.slot));
  }
  return entries;
}

/** One-off tasks without a date (the Pending list), including undated plan steps. */
export function pendingItems(items: Item[]): Item[] {
  const plans = new Set(items.filter((i) => i.type === "plan" && !i.deletedAt && !i.archivedAt).map((i) => i.id));
  return items.filter((i) => i.type !== "plan" && isPending(i) && (!i.parentId || plans.has(i.parentId)));
}
