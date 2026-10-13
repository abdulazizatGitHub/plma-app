import type { DayEntry } from "./day.js";
import { MOVED_SLOT_PREFIX } from "./day.js";
import type { CadenceRule, Category, Item, ItemDependency, Occurrence, Reminder, UserSettings } from "./entities.js";
import { occurrenceIdFor } from "./occurrence-id.js";
import { entryState } from "./progress.js";
import type { DayReminder } from "./reminders/model.js";

/*
 * Pure builders for Today's actions (FLX-01…03, TRK-01/02/05). Each returns the
 * rows to save locally (and sync); nothing here touches storage.
 */

export type Change =
  | { entity: "userSettings"; row: UserSettings }
  | { entity: "categories"; row: Category }
  | { entity: "items"; row: Item }
  | { entity: "occurrences"; row: Occurrence }
  | { entity: "itemDependencies"; row: ItemDependency }
  | { entity: "cadenceRules"; row: CadenceRule }
  | { entity: "reminders"; row: Reminder };

export type ActionContext = {
  userId: string;
  now: string;
  deviceId: string | null;
  /** Logging on a day after it ended (the correction window): stamped `detail.late`. The server re-checks. */
  late?: boolean;
};

/** The entry's stored occurrence with `patch` applied, or a new one for `date`. */
async function occurrenceWith(entry: DayEntry, date: string, ctx: ActionContext, patch: Partial<Occurrence>): Promise<Occurrence> {
  const base: Occurrence = entry.occurrence ?? {
    id: await occurrenceIdFor(entry.item.id, date, entry.slot),
    userId: ctx.userId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    deletedAt: null,
    itemId: entry.item.id,
    date,
    slot: entry.slot,
    status: "todo",
    value: null,
    detail: null,
    movedTo: null,
    movedFrom: entry.slot.startsWith(MOVED_SLOT_PREFIX) ? entry.slot.slice(MOVED_SLOT_PREFIX.length) : null,
    startedAt: null,
    completedAt: null,
    deviceId: ctx.deviceId,
  };
  const next: Occurrence = { ...base, ...patch, updatedAt: ctx.now, deviceId: ctx.deviceId };
  const extra: Record<string, unknown> = {};
  // The goal it was logged against, so editing the target later never rewrites past days.
  const t = entry.item.tracking;
  const target = t.kind === "quantity" ? t.target : t.kind === "duration" ? t.targetMin : undefined;
  if (target !== undefined && patch.value !== undefined) extra.target = target;
  if (ctx.late) extra.late = true;
  return Object.keys(extra).length ? { ...next, detail: { ...(next.detail ?? {}), ...extra } } : next;
}

const occ = (row: Occurrence): Change => ({ entity: "occurrences", row });
const item = (row: Item): Change => ({ entity: "items", row });

/** Checklist ticks stored on the occurrence, padded to the item's steps. */
export function checklistSteps(entry: DayEntry): boolean[] {
  const t = entry.item.tracking;
  if (t.kind !== "checklist") return [];
  const saved = entry.occurrence?.detail?.steps;
  const list = Array.isArray(saved) ? saved : [];
  return t.steps.map((_, i) => list[i] === true);
}

/**
 * One tap: done ↔ not done. Quantities and durations jump to their target (or
 * back to 0); checklists tick or clear every step.
 */
export async function toggleDone(entry: DayEntry, date: string, ctx: ActionContext): Promise<Change[]> {
  const done = entryState(entry) === "done";
  const t = entry.item.tracking;
  const value =
    t.kind === "quantity"
      ? done ? 0 : (t.target ?? entry.occurrence?.value ?? 0)
      : t.kind === "duration"
        ? done ? 0 : (t.targetMin ?? entry.occurrence?.value ?? 0)
        : (entry.occurrence?.value ?? null);
  const detail = t.kind === "checklist" ? { ...entry.occurrence?.detail, steps: t.steps.map(() => !done) } : (entry.occurrence?.detail ?? null);
  return [
    occ(
      await occurrenceWith(entry, date, ctx, {
        status: done ? "todo" : "done",
        value,
        detail,
        completedAt: done ? null : ctx.now,
      }),
    ),
  ];
}

/** Tick one checklist step; all ticked → done, some → in progress (TRK-04). */
export async function toggleChecklistStep(entry: DayEntry, date: string, index: number, ctx: ActionContext): Promise<Change[]> {
  const steps = checklistSteps(entry);
  if (index < 0 || index >= steps.length) return [];
  steps[index] = !steps[index];
  const ticked = steps.filter(Boolean).length;
  const status = ticked === steps.length ? "done" : ticked > 0 ? "in_progress" : "todo";
  return [
    occ(
      await occurrenceWith(entry, date, ctx, {
        status,
        detail: { ...entry.occurrence?.detail, steps },
        completedAt: status === "done" ? ctx.now : null,
      }),
    ),
  ];
}

/** Minutes logged for a duration item; status follows the target (TRK-03). */
export async function setDuration(entry: DayEntry, date: string, minutes: number, ctx: ActionContext): Promise<Change[]> {
  const t = entry.item.tracking;
  const target = t.kind === "duration" ? t.targetMin : undefined;
  const value = Math.max(0, Math.round(minutes));
  const status = target !== undefined && value >= target ? "done" : value > 0 ? "in_progress" : "todo";
  return [occ(await occurrenceWith(entry, date, ctx, { value, status, completedAt: status === "done" ? ctx.now : null }))];
}

/** Stepper / typed value for quantity items; status follows the target. */
export async function setQuantity(entry: DayEntry, date: string, value: number, ctx: ActionContext): Promise<Change[]> {
  const t = entry.item.tracking;
  const target = t.kind === "quantity" ? t.target : undefined;
  const status = target !== undefined && value >= target ? "done" : value > 0 ? "in_progress" : "todo";
  return [occ(await occurrenceWith(entry, date, ctx, { value, status, completedAt: status === "done" ? ctx.now : null }))];
}

/** "Started" puts a task in In Progress. */
export async function start(entry: DayEntry, date: string, ctx: ActionContext): Promise<Change[]> {
  return [occ(await occurrenceWith(entry, date, ctx, { status: "in_progress", startedAt: ctx.now }))];
}

/** Skip today — leaves the day without lowering the % (FLX-01). */
export async function skip(entry: DayEntry, date: string, ctx: ActionContext): Promise<Change[]> {
  return [occ(await occurrenceWith(entry, date, ctx, { status: "skipped" }))];
}

/** Undo a skip. */
export async function bringBack(entry: DayEntry, date: string, ctx: ActionContext): Promise<Change[]> {
  return [occ(await occurrenceWith(entry, date, ctx, { status: "todo" }))];
}

const isOneOff = (i: Item) => i.schedule.kind === "once";

/**
 * Move to another day, or to Pending (`to = null`, one-offs only) (FLX-02/03).
 *  - one-off: the task's date changes (its stored occurrence moves with it)
 *  - repeating: today is marked moved, and an extra instance appears on `to`
 *    in slot "moved:<from>" so it never collides with that day's own instance
 *  - an instance that was already moved in just changes day
 */
export async function moveTo(entry: DayEntry, from: string, to: string | null, ctx: ActionContext): Promise<Change[]> {
  const it = entry.item;
  if (isOneOff(it)) {
    const changes: Change[] = [item({ ...it, schedule: { ...it.schedule, kind: "once", date: to }, updatedAt: ctx.now })];
    if (entry.occurrence) changes.push(occ({ ...entry.occurrence, date: to, updatedAt: ctx.now, deviceId: ctx.deviceId }));
    // A one-off routine takes its sub-items (and their ticks) with it.
    for (const child of entry.children ?? []) {
      const c = child.item;
      if (c.schedule.kind === "once") changes.push(item({ ...c, schedule: { ...c.schedule, date: to }, updatedAt: ctx.now }));
      if (child.occurrence) changes.push(occ({ ...child.occurrence, date: to, updatedAt: ctx.now, deviceId: ctx.deviceId }));
    }
    return changes;
  }
  if (to === null) throw new Error("Only one-off tasks can be pending; skip a repeating item instead.");
  if (entry.slot.startsWith(MOVED_SLOT_PREFIX) && entry.occurrence) {
    return [occ({ ...entry.occurrence, date: to, updatedAt: ctx.now, deviceId: ctx.deviceId })];
  }
  const slot = `${MOVED_SLOT_PREFIX}${from}`;
  const movedIn = await occurrenceWith({ ...entry, slot, occurrence: null }, to, ctx, { status: "todo", movedFrom: from });
  return [occ(await occurrenceWith(entry, from, ctx, { status: "moved", movedTo: to })), occ(movedIn)];
}

/**
 * Prayer marking (PRY-03/04, PRY-09): prayed on time, prayed late (qada),
 * missed, or cleared. Any prayer, any order, any past day.
 */
export async function markPrayer(entry: DayEntry, date: string, mark: "prayed" | "qada" | "missed" | "clear", ctx: ActionContext): Promise<Change[]> {
  const detail = { ...(entry.occurrence?.detail ?? {}) };
  delete detail.qada;
  if (mark === "qada") detail.qada = true;
  const status = mark === "prayed" || mark === "qada" ? "done" : mark === "missed" ? "missed" : "todo";
  return [
    occ(
      await occurrenceWith(entry, date, ctx, {
        status,
        detail: Object.keys(detail).length ? detail : null,
        completedAt: status === "done" ? ctx.now : null,
      }),
    ),
  ];
}

export type TaskDraft = {
  title: string;
  /** null = pending. */
  date: string | null;
  /** Optional time of day, HH:mm (only with a date). */
  time?: string | null;
  categoryId: string | null;
  priority: Item["priority"];
};

/** A one-off schedule; the time is dropped for pending tasks. */
function onceSchedule(draft: TaskDraft): Item["schedule"] {
  return draft.date && draft.time ? { v: 1, kind: "once", date: draft.date, time: draft.time } : { v: 1, kind: "once", date: draft.date };
}

/** Quick add: a one-off check task (SCH-01/05/06). */
export function createTask(id: string, draft: TaskDraft, sortOrder: number, ctx: ActionContext): Change[] {
  return [
    item({
      id,
      userId: ctx.userId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      deletedAt: null,
      categoryId: draft.categoryId,
      parentId: null,
      type: "task",
      title: draft.title.trim(),
      notes: null,
      priority: draft.priority,
      isOptional: false,
      tracking: { v: 1, kind: "check" },
      schedule: onceSchedule(draft),
      meta: {},
      groupGoalId: null,
      sortOrder,
      archivedAt: null,
      sourceTemplateId: null,
      sourceTemplateVersion: null,
      adoptedAt: null,
    }),
  ];
}

/** Edit title / category / priority (and the date of one-off tasks). */
export function updateTask(existing: Item, draft: TaskDraft, ctx: ActionContext): Change[] {
  return [
    item({
      ...existing,
      title: draft.title.trim(),
      categoryId: draft.categoryId,
      priority: draft.priority,
      schedule: isOneOff(existing) ? onceSchedule(draft) : existing.schedule,
      updatedAt: ctx.now,
    }),
  ];
}

/** Soft delete — syncs as a tombstone. */
export function deleteItem(existing: Item, ctx: ActionContext): Change[] {
  return [item({ ...existing, deletedAt: ctx.now, updatedAt: ctx.now })];
}

/** Set (or with null, clear) this day's own reminder for the entry ("Remind me…", today only). */
export async function setDayReminder(entry: DayEntry, date: string, reminder: DayReminder | null, ctx: ActionContext): Promise<Change[]> {
  const detail = { ...(entry.occurrence?.detail ?? {}) };
  delete detail.reminder;
  if (reminder) detail.reminder = reminder;
  return [occ(await occurrenceWith(entry, date, ctx, { detail: Object.keys(detail).length ? detail : null }))];
}
