import type { Change, ActionContext } from "./actions.js";
import { categorySchema, itemSchema, type Category, type Item } from "./entities.js";
import type { Schedule, Tracking } from "./tracking.js";

/*
 * Builders for editing the user's own structure (Phase 3: CAT-01…05, ITM-01…07).
 * Like actions.ts they only return rows; the caller saves and syncs them.
 */

const cat = (row: Category): Change => ({ entity: "categories", row: categorySchema.parse(row) });
const itm = (row: Item): Change => ({ entity: "items", row: itemSchema.parse(row) });
const live = <T extends { deletedAt: string | null }>(r: T) => !r.deletedAt;

const noProvenance = { sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null } as const;

// ---- Categories ----------------------------------------------------------------

export type CategoryDraft = { name: string; icon: string; color: string };

export function createCategory(id: string, draft: CategoryDraft, sortOrder: number, ctx: ActionContext): Change[] {
  return [
    cat({
      id,
      userId: ctx.userId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      deletedAt: null,
      name: draft.name.trim(),
      icon: draft.icon,
      color: draft.color,
      sortOrder,
      archivedAt: null,
      ...noProvenance,
    }),
  ];
}

export function updateCategory(existing: Category, draft: CategoryDraft, ctx: ActionContext): Change[] {
  return [cat({ ...existing, name: draft.name.trim(), icon: draft.icon, color: draft.color, updatedAt: ctx.now })];
}

/**
 * Archive hides the category and its items everywhere but keeps their history.
 * Items get the same `archivedAt`, so unarchiving restores exactly those.
 */
export function archiveCategory(existing: Category, items: Item[], ctx: ActionContext): Change[] {
  const changes = [cat({ ...existing, archivedAt: ctx.now, updatedAt: ctx.now })];
  for (const i of items) {
    if (i.categoryId === existing.id && live(i) && !i.archivedAt) changes.push(itm({ ...i, archivedAt: ctx.now, updatedAt: ctx.now }));
  }
  return changes;
}

export function unarchiveCategory(existing: Category, items: Item[], ctx: ActionContext): Change[] {
  const changes = [cat({ ...existing, archivedAt: null, updatedAt: ctx.now })];
  for (const i of items) {
    if (i.categoryId === existing.id && live(i) && existing.archivedAt && i.archivedAt === existing.archivedAt) {
      changes.push(itm({ ...i, archivedAt: null, updatedAt: ctx.now }));
    }
  }
  return changes;
}

/** Delete the category; its items move to "No category" (and come back if they were archived with it). */
export function deleteCategory(existing: Category, items: Item[], ctx: ActionContext): Change[] {
  const changes = [cat({ ...existing, deletedAt: ctx.now, updatedAt: ctx.now })];
  for (const i of items) {
    if (i.categoryId !== existing.id || !live(i)) continue;
    const cascaded = existing.archivedAt !== null && i.archivedAt === existing.archivedAt;
    changes.push(itm({ ...i, categoryId: null, archivedAt: cascaded ? null : i.archivedAt, updatedAt: ctx.now }));
  }
  return changes;
}

/**
 * Move one row up (-1) or down (+1) among `siblings`. Renumbers the list
 * 0…n-1 and returns only rows whose order changed.
 */
function reorder<T extends { id: string; sortOrder: number; updatedAt: string }>(siblings: T[], id: string, dir: -1 | 1, now: string): T[] {
  const list = [...siblings].sort((a, b) => a.sortOrder - b.sortOrder);
  const at = list.findIndex((r) => r.id === id);
  const to = at + dir;
  if (at < 0 || to < 0 || to >= list.length) return [];
  [list[at], list[to]] = [list[to], list[at]];
  return list.flatMap((r, i) => (r.sortOrder === i ? [] : [{ ...r, sortOrder: i, updatedAt: now }]));
}

export function moveCategory(categories: Category[], id: string, dir: -1 | 1, ctx: ActionContext): Change[] {
  return reorder(categories.filter(live), id, dir, ctx.now).map(cat);
}

// ---- Items ---------------------------------------------------------------------

/** Kinds the editor offers: one-off task, repeating habit, routine (group with sub-items). */
export type EditableItemType = "task" | "habit" | "group";

export type ItemDraft = {
  type: EditableItemType;
  title: string;
  categoryId: string | null;
  parentId?: string | null;
  priority: Item["priority"];
  isOptional: boolean;
  notes: string | null;
  tracking: Tracking;
  schedule: Schedule;
};

/** Tasks are always one-off; habits and routines repeat (a routine may also be a one-off). */
function normalise(draft: ItemDraft): ItemDraft {
  const notes = draft.notes?.trim() ? draft.notes.trim() : null;
  if (draft.type === "task" && draft.schedule.kind !== "once") throw new Error("A task happens once; use a habit to repeat it.");
  if (draft.type === "habit" && draft.schedule.kind === "once") throw new Error("A habit repeats; use a task for a one-off.");
  // Routines track through their sub-items.
  const tracking: Tracking = draft.type === "group" ? { v: 1, kind: "check" } : draft.tracking;
  return { ...draft, title: draft.title.trim(), notes, tracking };
}

export function createItem(id: string, draft: ItemDraft, sortOrder: number, ctx: ActionContext): Change[] {
  const d = normalise(draft);
  return [
    itm({
      id,
      userId: ctx.userId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      deletedAt: null,
      categoryId: d.categoryId,
      parentId: d.parentId ?? null,
      type: d.type,
      title: d.title,
      notes: d.notes,
      priority: d.priority,
      isOptional: d.isOptional,
      tracking: d.tracking,
      schedule: d.schedule,
      meta: {},
      groupGoalId: null,
      sortOrder,
      archivedAt: null,
      ...noProvenance,
    }),
  ];
}

/** Save the editor. Sub-items follow their routine's category and schedule. */
export function updateItem(existing: Item, draft: ItemDraft, children: Item[], ctx: ActionContext): Change[] {
  const d = normalise(draft);
  const next: Item = {
    ...existing,
    type: d.type,
    title: d.title,
    categoryId: d.categoryId,
    priority: d.priority,
    isOptional: d.isOptional,
    notes: d.notes,
    tracking: d.tracking,
    schedule: d.schedule,
    updatedAt: ctx.now,
  };
  const changes = [itm(next)];
  for (const c of children) {
    if (c.parentId !== existing.id || !live(c)) continue;
    if (c.categoryId !== next.categoryId || JSON.stringify(c.schedule) !== JSON.stringify(next.schedule)) {
      changes.push(itm({ ...c, categoryId: next.categoryId, schedule: next.schedule, updatedAt: ctx.now }));
    }
  }
  return changes;
}

export type ChildDraft = { id?: string; title: string };

/**
 * Make a routine's sub-items match `drafts` (in order): new titles are created,
 * renamed ones updated, missing ones deleted (ITM-03).
 */
export function saveChildren(parent: Item, existing: Item[], drafts: ChildDraft[], ctx: ActionContext, newId: () => string): Change[] {
  const current = new Map(existing.filter((c) => c.parentId === parent.id && live(c)).map((c) => [c.id, c]));
  const changes: Change[] = [];
  drafts.forEach((d, sortOrder) => {
    const title = d.title.trim();
    const old = d.id ? current.get(d.id) : undefined;
    if (old) {
      current.delete(old.id);
      if (old.title !== title || old.sortOrder !== sortOrder) changes.push(itm({ ...old, title, sortOrder, updatedAt: ctx.now }));
      return;
    }
    changes.push(
      ...createItem(
        newId(),
        {
          type: parent.schedule.kind === "once" ? "task" : "habit",
          title,
          categoryId: parent.categoryId,
          parentId: parent.id,
          priority: parent.priority,
          isOptional: false,
          notes: null,
          tracking: { v: 1, kind: "check" },
          schedule: parent.schedule,
        },
        sortOrder,
        ctx,
      ),
    );
  });
  for (const gone of current.values()) changes.push(itm({ ...gone, deletedAt: ctx.now, updatedAt: ctx.now }));
  return changes;
}

export function archiveItem(existing: Item, children: Item[], ctx: ActionContext): Change[] {
  return [existing, ...children.filter((c) => c.parentId === existing.id && live(c) && !c.archivedAt)].map((i) =>
    itm({ ...i, archivedAt: ctx.now, updatedAt: ctx.now }),
  );
}

export function unarchiveItem(existing: Item, children: Item[], ctx: ActionContext): Change[] {
  return [existing, ...children.filter((c) => c.parentId === existing.id && live(c) && c.archivedAt === existing.archivedAt)].map((i) =>
    itm({ ...i, archivedAt: null, updatedAt: ctx.now }),
  );
}

/** Delete an item (and a routine's sub-items) as tombstones. */
export function deleteItemTree(existing: Item, children: Item[], ctx: ActionContext): Change[] {
  return [existing, ...children.filter((c) => c.parentId === existing.id && live(c))].map((i) => itm({ ...i, deletedAt: ctx.now, updatedAt: ctx.now }));
}

export function moveItem(siblings: Item[], id: string, dir: -1 | 1, ctx: ActionContext): Change[] {
  return reorder(siblings.filter(live), id, dir, ctx.now).map(itm);
}

export const isPinned = (i: Pick<Item, "meta">) => i.meta.pinned === true;

export function pinItem(existing: Item, pinned: boolean, ctx: ActionContext): Change[] {
  const meta = { ...existing.meta };
  if (pinned) meta.pinned = true;
  else delete meta.pinned;
  return [itm({ ...existing, meta, updatedAt: ctx.now })];
}

/** Pinned first, then saved order. */
export function sortItems<T extends Pick<Item, "meta" | "sortOrder" | "createdAt">>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => Number(isPinned(b)) - Number(isPinned(a)) || a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt),
  );
}

/** The v1 prayer set (and future prayer groups) render as prayer chips, not a routine. */
export const isPrayerGroup = (i: Pick<Item, "meta">) => i.meta.prayerSet === true;
