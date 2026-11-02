import type { Item, ItemDependency, Occurrence } from "../entities.js";

/*
 * Plan state (PLN-01/02, PLN-06): which steps are done, which are locked and
 * why, and how far along a plan is. A plan is complete when its last step is.
 */

const live = <T extends { deletedAt: string | null }>(r: T) => !r.deletedAt;

/** A step (one-off) is done when any of its occurrences is done. */
export function stepDone(step: Pick<Item, "id">, occurrences: Occurrence[]): boolean {
  return occurrences.some((o) => o.itemId === step.id && live(o) && o.status === "done");
}

/** Steps this step waits for that aren't done yet (the lock and its reason). */
export function lockOf(step: Pick<Item, "id">, deps: ItemDependency[], steps: Item[], occurrences: Occurrence[]): { locked: boolean; waitingFor: Item[] } {
  const waitingFor = deps
    .filter((d) => live(d) && d.itemId === step.id)
    .map((d) => steps.find((s) => s.id === d.dependsOnId && live(s)))
    .filter((s): s is Item => Boolean(s) && !stepDone(s as Item, occurrences));
  return { locked: waitingFor.length > 0, waitingFor };
}

const dateOf = (i: Item) => (i.schedule.kind === "once" ? i.schedule.date : null);

export type PlanProgress = {
  total: number;
  done: number;
  pct: number;
  /** The next step to do: earliest dated (today or later), else the first undated one. */
  next: Item | null;
  /** Dated steps before today that aren't done. */
  overdue: number;
  complete: boolean;
};

export function planProgress(plan: Pick<Item, "id">, steps: Item[], occurrences: Occurrence[], today: string): PlanProgress {
  const mine = steps.filter((s) => s.parentId === plan.id && live(s) && !s.archivedAt);
  const open = mine.filter((s) => !stepDone(s, occurrences));
  const dated = open.filter((s) => dateOf(s)).sort((a, b) => (dateOf(a) ?? "").localeCompare(dateOf(b) ?? "") || a.sortOrder - b.sortOrder);
  const next = dated.find((s) => (dateOf(s) ?? "") >= today) ?? open.find((s) => !dateOf(s)) ?? dated[0] ?? null;
  const done = mine.length - open.length;
  return {
    total: mine.length,
    done,
    pct: mine.length ? Math.round((done / mine.length) * 100) : 0,
    next,
    overdue: dated.filter((s) => (dateOf(s) ?? "") < today).length,
    complete: mine.length > 0 && open.length === 0,
  };
}

/** True if making `stepId` wait for `dependsOnIds` would create a loop (or wait on itself). */
export function wouldCycle(stepId: string, dependsOnIds: string[], deps: ItemDependency[]): boolean {
  const edges = new Map<string, string[]>();
  for (const d of deps) if (live(d) && d.itemId !== stepId) edges.set(d.itemId, [...(edges.get(d.itemId) ?? []), d.dependsOnId]);
  edges.set(stepId, dependsOnIds);
  const seen = new Set<string>();
  const stack = [...dependsOnIds];
  while (stack.length) {
    const id = stack.pop() as string;
    if (id === stepId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(edges.get(id) ?? []));
  }
  return false;
}
