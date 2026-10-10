import type { ActionContext, Change } from "./actions.js";
import { categorySchema, itemSchema, type Category, type Item } from "./entities.js";
import type { Schedule, Tracking } from "./tracking.js";

/*
 * Starter packs (Phase 3, CAT-05). They ship with the app so onboarding works
 * offline; the API serves the same list (GET /v1/templates) and seeds the
 * `templates` table for the Phase 12 library. Ids are fixed forever — they are
 * the provenance (`sourceTemplateId`) on everything a pack creates.
 */

export type PackItem = {
  type: "habit" | "group";
  title: string;
  tracking?: Tracking;
  schedule?: Schedule;
  priority?: Item["priority"];
  isOptional?: boolean;
  /** Routine sub-items (type "group"). */
  children?: string[];
};

export type StarterPack = {
  id: string;
  version: number;
  name: string;
  description: string;
  category: { name: string; icon: string; color: string };
  items: PackItem[];
};

const daily: Schedule = { v: 1, kind: "daily" };
const weekdays = (...days: number[]): Schedule => ({ v: 1, kind: "weekdays", weekdays: days });
const count = (unit: string, target: number, step: number): Tracking => ({ v: 1, kind: "quantity", unit, target, step });
const minutes = (targetMin: number): Tracking => ({ v: 1, kind: "duration", targetMin });

export const STARTER_PACKS: StarterPack[] = [
  {
    id: "5e7a1c00-0001-4000-8000-000000000001",
    version: 1,
    name: "Spiritual",
    description: "Quran reading and the weekly surahs.",
    category: { name: "Spiritual", icon: "moon", color: "peach" },
    items: [
      { type: "habit", title: "Quran reading", tracking: count("pages", 2, 1) },
      { type: "habit", title: "Surah Al-Kahf", schedule: weekdays(5) },
      { type: "habit", title: "Surah Al-Mulk" },
      { type: "habit", title: "Morning & evening adhkar", isOptional: true },
    ],
  },
  {
    id: "5e7a1c00-0002-4000-8000-000000000002",
    version: 1,
    name: "Physical",
    description: "Steps, a push-day routine and stretching.",
    category: { name: "Physical", icon: "dumbbell", color: "mint" },
    items: [
      { type: "habit", title: "Steps", tracking: count("steps", 10000, 500), priority: "high" },
      {
        type: "group",
        title: "Gym — Push day",
        schedule: weekdays(1, 3, 5),
        children: ["Bench press", "Overhead press", "Incline dumbbell press", "Lateral raises", "Triceps pushdown"],
      },
      { type: "habit", title: "Stretch", tracking: minutes(10) },
    ],
  },
  {
    id: "5e7a1c00-0003-4000-8000-000000000003",
    version: 1,
    name: "Health",
    description: "Water, sleep and daily vitamins.",
    category: { name: "Health", icon: "heart", color: "pink" },
    items: [
      { type: "habit", title: "Water", tracking: count("glasses", 8, 1) },
      { type: "habit", title: "Sleep by 11 PM" },
      { type: "habit", title: "Vitamins" },
    ],
  },
  {
    id: "5e7a1c00-0004-4000-8000-000000000004",
    version: 1,
    name: "Mental",
    description: "Journaling, reading and less scrolling.",
    category: { name: "Mental", icon: "brain", color: "lilac" },
    items: [
      { type: "habit", title: "Journal", tracking: minutes(10) },
      { type: "habit", title: "Read", tracking: count("pages", 10, 5) },
      { type: "habit", title: "No social media before noon", isOptional: true },
    ],
  },
  {
    id: "5e7a1c00-0005-4000-8000-000000000005",
    version: 1,
    name: "Content creation",
    description: "Capture ideas and ship videos step by step.",
    category: { name: "Content", icon: "video", color: "sky" },
    items: [
      { type: "habit", title: "Write down one idea" },
      {
        type: "habit",
        title: "Video",
        schedule: weekdays(2, 5),
        tracking: { v: 1, kind: "checklist", steps: ["Script", "Shoot", "Edit", "Thumbnail", "Publish"] },
      },
    ],
  },
  {
    id: "5e7a1c00-0006-4000-8000-000000000006",
    version: 1,
    name: "University",
    description: "Revision and assignment check-ins.",
    category: { name: "University", icon: "graduation", color: "lime" },
    items: [
      { type: "habit", title: "Revise today's lectures", schedule: weekdays(1, 2, 3, 4, 5), tracking: minutes(30) },
      { type: "habit", title: "Check assignments & deadlines", schedule: weekdays(1, 4) },
    ],
  },
  {
    id: "5e7a1c00-0007-4000-8000-000000000007",
    version: 1,
    name: "Work",
    description: "Plan the day, clear the inbox, review the week.",
    category: { name: "Work", icon: "briefcase", color: "teal" },
    items: [
      { type: "habit", title: "Plan the day", schedule: weekdays(1, 2, 3, 4, 5) },
      { type: "habit", title: "Inbox zero", schedule: weekdays(1, 2, 3, 4, 5), isOptional: true },
      { type: "habit", title: "Weekly review", schedule: weekdays(5) },
    ],
  },
];

export const packById = (id: string) => STARTER_PACKS.find((p) => p.id === id);

/** Packs this user already adopted (a live category carries the pack id). */
export function adoptedPackIds(categories: Category[]): Set<string> {
  return new Set(categories.filter((c) => !c.deletedAt && c.sourceTemplateId).map((c) => c.sourceTemplateId as string));
}

/**
 * Rows for the chosen packs: one category each, its items and routine
 * sub-items, all stamped with the pack's id and version. Packs already
 * adopted are skipped, so applying twice adds nothing.
 */
export function applyPacks(
  packIds: string[],
  existing: Category[],
  ctx: ActionContext,
  newId: () => string,
  firstSortOrder = 0,
): Change[] {
  const adopted = adoptedPackIds(existing);
  const changes: Change[] = [];
  let order = firstSortOrder;
  for (const pack of STARTER_PACKS) {
    if (!packIds.includes(pack.id) || adopted.has(pack.id)) continue;
    const provenance = { sourceTemplateId: pack.id, sourceTemplateVersion: pack.version, adoptedAt: ctx.now };
    const base = { userId: ctx.userId, createdAt: ctx.now, updatedAt: ctx.now, deletedAt: null };
    const categoryId = newId();
    changes.push({
      entity: "categories",
      row: categorySchema.parse({ id: categoryId, ...base, ...pack.category, sortOrder: order++, archivedAt: null, ...provenance }),
    });
    const makeItem = (spec: PackItem, sortOrder: number, parentId: string | null, schedule: Schedule): Item =>
      itemSchema.parse({
        id: newId(),
        ...base,
        categoryId,
        parentId,
        type: spec.type,
        title: spec.title,
        notes: null,
        priority: spec.priority ?? "medium",
        isOptional: spec.isOptional ?? false,
        tracking: spec.type === "group" ? { v: 1, kind: "check" } : (spec.tracking ?? { v: 1, kind: "check" }),
        schedule,
        meta: {},
        groupGoalId: null,
        sortOrder,
        archivedAt: null,
        ...provenance,
      });
    pack.items.forEach((spec, i) => {
      const schedule = spec.schedule ?? daily;
      const parent = makeItem(spec, i, null, schedule);
      changes.push({ entity: "items", row: parent });
      (spec.children ?? []).forEach((title, j) => {
        changes.push({ entity: "items", row: makeItem({ type: "habit", title }, j, parent.id, schedule) });
      });
    });
  }
  return changes;
}
