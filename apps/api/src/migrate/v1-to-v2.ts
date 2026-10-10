import { createHash } from "node:crypto";
import {
  PRAYER_NAMES,
  categorySchema,
  itemSchema,
  occurrenceSchema,
  type Category,
  type Item,
  type Occurrence,
  type Schedule,
  type Tracking,
} from "@life/shared";

/*
 * v1 → v2 data migration (REQUIREMENTS_V2 §6). Pure: takes the old Owner's
 * habit definitions + logs and returns v2 categories, items and occurrences
 * for the new account. Ids are derived deterministically from the old ids, so
 * running the migration twice produces the same rows (idempotent).
 */

export type V1Definition = {
  id: string;
  slug: string;
  name: string;
  category: string;
  trackingMethod: string;
  frequency: string;
  config: Record<string, unknown>;
  archivedAt: string | null;
  deletedAt: string | null;
};

export type V1Log = {
  id: string;
  habitDefinitionId: string;
  logDate: string;
  payload: Record<string, unknown>;
  updatedAt: string;
  deletedAt: string | null;
};

export type V2Rows = { categories: Category[]; items: Item[]; occurrences: Occurrence[] };

/** Name-based UUID (v5 layout over SHA-1) — stable across runs. */
export function stableId(seed: string): string {
  const h = createHash("sha1").update(`life-v1-migration:${seed}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const CATEGORY_STYLE: Record<string, { name: string; icon: string; color: string }> = {
  faith: { name: "Spiritual", icon: "moon", color: "peach" },
  health: { name: "Physical", icon: "dumbbell", color: "mint" },
  personal: { name: "Personal", icon: "sparkles", color: "lilac" },
};

/** v1 prayer key → v2 { label, prayer-time key (adhan naming) }. */
const PRAYER_V2: Record<(typeof PRAYER_NAMES)[number], { label: string; key: string }> = {
  fajr: { label: "Fajr", key: "fajr" },
  zuhr: { label: "Zuhr", key: "dhuhr" },
  asr: { label: "Asr", key: "asr" },
  maghrib: { label: "Maghrib", key: "maghrib" },
  isha: { label: "Isha", key: "isha" },
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function trackingFor(def: V1Definition): Tracking {
  const goal = num(def.config.goal);
  switch (def.slug) {
    case "steps":
      return { v: 1, kind: "quantity", unit: "steps", target: goal ?? 10000, step: 500 };
    case "water":
      return { v: 1, kind: "quantity", unit: "glasses", target: goal ?? 8, step: 1 };
    case "exercise":
    case "sleep":
      return { v: 1, kind: "duration" };
    case "no-phone-hour":
      return { v: 1, kind: "duration", targetMin: num(def.config.durationMinutes) ?? 60 };
  }
  if (def.trackingMethod === "counter") {
    const unit = typeof def.config.unit === "string" && def.config.unit ? def.config.unit : "times";
    return { v: 1, kind: "quantity", unit, target: goal, step: 1 };
  }
  if (def.trackingMethod === "duration" || def.trackingMethod === "timer") return { v: 1, kind: "duration" };
  return { v: 1, kind: "check" };
}

function scheduleFor(def: V1Definition): Schedule {
  if (def.slug === "quran-kahf" || def.frequency === "weekly_friday") {
    return { v: 1, kind: "weekdays", weekdays: [5], anchor: { type: "prayer", prayer: "dhuhr", relation: "after", offsetMin: 0 } };
  }
  if (def.slug === "quran-mulk") {
    return { v: 1, kind: "daily", anchor: { type: "prayer", prayer: "isha", relation: "after", offsetMin: 0 } };
  }
  return { v: 1, kind: "daily" };
}

export function mapV1ToV2(input: { userId: string; now: string; definitions: V1Definition[]; logs: V1Log[] }): V2Rows {
  const { userId, now } = input;
  const row = (id: string, at = now) => ({ id, userId, createdAt: at, updatedAt: at, deletedAt: null });
  const provenance = { sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null };

  const defs = input.definitions.filter((d) => !d.deletedAt);
  const categories: Category[] = [];
  const categoryIds = new Map<string, string>();
  for (const def of defs) {
    if (categoryIds.has(def.category)) continue;
    const style = CATEGORY_STYLE[def.category] ?? {
      name: def.category.charAt(0).toUpperCase() + def.category.slice(1),
      icon: "tag",
      color: "sky",
    };
    const id = stableId(`category:${userId}:${def.category}`);
    categoryIds.set(def.category, id);
    categories.push({ ...row(id), ...style, sortOrder: categories.length, archivedAt: null, ...provenance });
  }

  const items: Item[] = [];
  const itemFor = new Map<string, Item>();
  /** Prayer group children by v1 definition id + v1 prayer key. */
  const prayerChild = new Map<string, string>();
  const baseItem = (def: V1Definition, id: string) => ({
    ...row(id),
    categoryId: categoryIds.get(def.category) ?? null,
    parentId: null as string | null,
    notes: null,
    priority: "medium" as const,
    isOptional: false,
    meta: { migratedFrom: def.slug } as Record<string, unknown>,
    groupGoalId: null,
    sortOrder: items.length,
    archivedAt: def.archivedAt,
    ...provenance,
  });

  for (const def of defs) {
    const id = stableId(`item:${def.id}`);
    if (def.slug === "prayer") {
      const group: Item = { ...baseItem(def, id), type: "group", title: def.name || "Daily prayers", tracking: { v: 1, kind: "check" }, schedule: { v: 1, kind: "daily" }, meta: { migratedFrom: "prayer", prayerSet: true } };
      items.push(group);
      itemFor.set(def.id, group);
      PRAYER_NAMES.forEach((name, i) => {
        const childId = stableId(`item:${def.id}:${name}`);
        prayerChild.set(`${def.id}:${name}`, childId);
        items.push({
          ...baseItem(def, childId),
          parentId: id,
          type: "habit",
          title: PRAYER_V2[name].label,
          tracking: { v: 1, kind: "check" },
          schedule: { v: 1, kind: "daily" },
          meta: { migratedFrom: "prayer", prayerKey: PRAYER_V2[name].key },
          sortOrder: i,
        });
      });
      continue;
    }
    const item: Item = {
      ...baseItem(def, id),
      type: "habit",
      title: def.name,
      tracking: trackingFor(def),
      schedule: scheduleFor(def),
      meta: { migratedFrom: def.slug, ...(def.slug === "sleep" && typeof def.config.wakeGoal === "string" ? { wakeGoal: def.config.wakeGoal } : {}) },
    };
    items.push(item);
    itemFor.set(def.id, item);
  }

  const occurrences: Occurrence[] = [];
  const occ = (itemId: string, log: V1Log, over: Partial<Occurrence>): Occurrence => ({
    ...row(stableId(`occ:${itemId}:${log.logDate}`), log.updatedAt),
    itemId,
    date: log.logDate,
    slot: "",
    status: "done",
    value: null,
    detail: null,
    movedTo: null,
    movedFrom: null,
    startedAt: null,
    completedAt: null,
    deviceId: null,
    ...over,
  });

  for (const log of input.logs) {
    if (log.deletedAt) continue;
    const def = defs.find((d) => d.id === log.habitDefinitionId);
    const item = def && itemFor.get(def.id);
    if (!def || !item) continue;
    const p = log.payload;

    if (def.slug === "prayer") {
      const prayers = (p.prayers ?? {}) as Record<string, unknown>;
      for (const name of PRAYER_NAMES) {
        const status = prayers[name];
        if (status !== "completed" && status !== "missed") continue; // pending → nothing stored
        occurrences.push(occ(prayerChild.get(`${def.id}:${name}`)!, log, { status: status === "completed" ? "done" : "missed" }));
      }
      continue;
    }

    const tracking = item.tracking;
    if (def.slug === "sleep") {
      const bed = typeof p.bedAt === "string" ? Date.parse(p.bedAt) : NaN;
      const wake = typeof p.wakeAt === "string" ? Date.parse(p.wakeAt) : NaN;
      if (Number.isNaN(bed) || Number.isNaN(wake) || wake <= bed) continue;
      occurrences.push(occ(item.id, log, { value: Math.round((wake - bed) / 60000), detail: { bedAt: p.bedAt, wakeAt: p.wakeAt } }));
    } else if (tracking.kind === "quantity") {
      const value = num(p.value) ?? 0;
      if (value <= 0) continue;
      occurrences.push(occ(item.id, log, { value, status: tracking.target && value < tracking.target ? "in_progress" : "done" }));
    } else if (p.completed === true) {
      const minutes = num(p.durationMinutes);
      const detail = typeof p.type === "string" ? { type: p.type } : null;
      occurrences.push(occ(item.id, log, { value: tracking.kind === "duration" ? (minutes ?? null) : null, detail }));
    }
  }

  // Fail loudly rather than write rows the app would reject on sync.
  categories.forEach((c) => categorySchema.parse(c));
  items.forEach((i) => itemSchema.parse(i));
  occurrences.forEach((o) => occurrenceSchema.parse(o));
  return { categories, items, occurrences };
}
