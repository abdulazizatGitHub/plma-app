import type { ActionContext, Change } from "../actions.js";
import { itemSchema, type Item } from "../entities.js";
import type { Anchor, Schedule } from "../tracking.js";

/*
 * The "Daily prayers" block (PRY-01/02, SYSTEM_DESIGN §5.3): a group item
 * marked `meta.prayerSet` whose children are prayers with `meta.prayerKey`.
 * Ids never change on rename or reorder, so the ring, insights and history
 * follow the prayer.
 */

export type PrayerDef = { key: string; title: string; anchor?: Anchor };

export const DEFAULT_PRAYERS: PrayerDef[] = [
  { key: "fajr", title: "Fajr" },
  { key: "dhuhr", title: "Zuhr" },
  { key: "asr", title: "Asr" },
  { key: "maghrib", title: "Maghrib" },
  { key: "isha", title: "Isha" },
];

/** Extra prayers offered in Prayer settings, with a sensible place in the day. */
export const EXTRA_PRAYERS: PrayerDef[] = [
  { key: "tahajjud", title: "Tahajjud", anchor: { type: "prayer", prayer: "fajr", relation: "before", offsetMin: 0 } },
  { key: "duha", title: "Duha", anchor: { type: "prayer", prayer: "sunrise", relation: "after", offsetMin: 20 } },
  { key: "witr", title: "Witr", anchor: { type: "prayer", prayer: "isha", relation: "after", offsetMin: 0 } },
];

export const prayerKeyOf = (item: Pick<Item, "meta">): string | null => (typeof item.meta.prayerKey === "string" ? item.meta.prayerKey : null);

/** A key for a prayer the user typed ("Ishraq" → "ishraq"). */
export const slugPrayerKey = (title: string) =>
  title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32) || "prayer";

const daily = (anchor?: Anchor): Schedule => (anchor ? { v: 1, kind: "daily", anchor } : { v: 1, kind: "daily" });

function prayerItem(ctx: ActionContext, id: string, parent: Item, def: PrayerDef, sortOrder: number): Item {
  return itemSchema.parse({
    id,
    userId: ctx.userId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    deletedAt: null,
    categoryId: parent.categoryId,
    parentId: parent.id,
    type: "habit",
    title: def.title,
    notes: null,
    priority: "high",
    isOptional: false,
    tracking: { v: 1, kind: "check" },
    schedule: daily(def.anchor),
    meta: { prayerKey: def.key },
    groupGoalId: null,
    sortOrder,
    archivedAt: null,
    sourceTemplateId: parent.sourceTemplateId,
    sourceTemplateVersion: parent.sourceTemplateVersion,
    adoptedAt: parent.adoptedAt,
  });
}

/** The prayer block with the five daily prayers. */
export function createPrayerSet(
  ctx: ActionContext,
  newId: () => string,
  opts: { categoryId: string | null; sortOrder?: number; provenance?: Pick<Item, "sourceTemplateId" | "sourceTemplateVersion" | "adoptedAt"> },
): Change[] {
  const parent = itemSchema.parse({
    id: newId(),
    userId: ctx.userId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    deletedAt: null,
    categoryId: opts.categoryId,
    parentId: null,
    type: "group",
    title: "Daily prayers",
    notes: null,
    priority: "high",
    isOptional: false,
    tracking: { v: 1, kind: "check" },
    schedule: { v: 1, kind: "daily" },
    meta: { prayerSet: true },
    groupGoalId: null,
    sortOrder: opts.sortOrder ?? -1,
    archivedAt: null,
    sourceTemplateId: opts.provenance?.sourceTemplateId ?? null,
    sourceTemplateVersion: opts.provenance?.sourceTemplateVersion ?? null,
    adoptedAt: opts.provenance?.adoptedAt ?? null,
  });
  return [
    { entity: "items", row: parent },
    ...DEFAULT_PRAYERS.map((def, i): Change => ({ entity: "items", row: prayerItem(ctx, newId(), parent, def, i) })),
  ];
}

export type PrayerDraft = { id?: string; title: string; key?: string };

/**
 * Make the prayer set match `drafts` (in order): rename, reorder, add (with
 * known extras getting their key and place in the day), remove (PRY-01).
 */
export function savePrayerSet(parent: Item, existing: Item[], drafts: PrayerDraft[], ctx: ActionContext, newId: () => string): Change[] {
  const current = new Map(existing.filter((c) => c.parentId === parent.id && !c.deletedAt).map((c) => [c.id, c]));
  const used = new Set([...current.values()].map((c) => prayerKeyOf(c)).filter(Boolean) as string[]);
  const changes: Change[] = [];
  drafts.forEach((d, sortOrder) => {
    const title = d.title.trim();
    if (!title) return;
    const old = d.id ? current.get(d.id) : undefined;
    if (old) {
      current.delete(old.id);
      if (old.title !== title || old.sortOrder !== sortOrder) changes.push({ entity: "items", row: itemSchema.parse({ ...old, title, sortOrder, updatedAt: ctx.now }) });
      return;
    }
    const known = [...DEFAULT_PRAYERS, ...EXTRA_PRAYERS].find((p) => p.key === d.key || p.title.toLowerCase() === title.toLowerCase());
    let key = d.key ?? known?.key ?? slugPrayerKey(title);
    while (used.has(key)) key = `${key}_2`;
    used.add(key);
    changes.push({ entity: "items", row: prayerItem(ctx, newId(), parent, { key, title, anchor: known?.anchor }, sortOrder) });
  });
  for (const gone of current.values()) changes.push({ entity: "items", row: itemSchema.parse({ ...gone, deletedAt: ctx.now, updatedAt: ctx.now }) });
  return changes;
}
