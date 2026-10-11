import type { ActionContext, Change } from "./actions.js";
import { categorySchema, itemSchema, type Category, type Item } from "./entities.js";
import { createPrayerSet, DEFAULT_PRAYERS } from "./prayer/prayer-set.js";
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
  /** The Daily prayers block (built by createPrayerSet, with prayer keys). */
  prayerSet?: boolean;
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
    version: 2,
    name: "Spiritual",
    description: "Daily prayers, Quran reading and the weekly surahs.",
    category: { name: "Spiritual", icon: "moon", color: "peach" },
    items: [
      { type: "group", title: "Five daily prayers", prayerSet: true, children: DEFAULT_PRAYERS.map((p) => p.title) },
      { type: "habit", title: "Quran reading", tracking: count("pages", 2, 1) },
      {
        type: "habit",
        title: "Surah Al-Kahf",
        schedule: { v: 1, kind: "weekdays", weekdays: [5], anchor: { type: "prayer", prayer: "dhuhr", relation: "after", offsetMin: 0 } },
      },
      { type: "habit", title: "Surah Al-Mulk", schedule: { v: 1, kind: "daily", anchor: { type: "prayer", prayer: "isha", relation: "after", offsetMin: 0 } } },
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
    description: "Capture ideas and ship videos step by step — plus collab plans (shoot, edit, payment, post).",
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
    description: "Revision and check-ins — plus course plans for assignments, quizzes and FYP.",
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

/** One interest the user picked, with the suggested items they ticked (by index) and any target they changed. */
export type PackChoice = { packId: string; items: { index: number; target?: number }[] };

/** The item's tracking with the user's target, if they changed it. */
function tuned(spec: PackItem, target: number | undefined): Tracking {
  const t = spec.tracking ?? { v: 1, kind: "check" };
  if (target === undefined) return t;
  if (t.kind === "quantity") return { ...t, target };
  if (t.kind === "duration") return { ...t, targetMin: target };
  return t;
}

/** What a suggestion can tune in setup: a count target or minutes. */
export function tunableTarget(spec: PackItem): { value: number; unit: string; max: number } | null {
  const t = spec.tracking;
  if (t?.kind === "quantity" && t.target !== undefined) return { value: t.target, unit: t.unit, max: 1_000_000 };
  if (t?.kind === "duration" && t.targetMin !== undefined) return { value: t.targetMin, unit: "min", max: 1440 };
  return null;
}

/**
 * Rows for the user's setup choices: one category per chosen interest, plus
 * only the suggested items they ticked (owner, 2026-10-11: nothing is added
 * unless ticked). Everything carries the pack's id and version. Interests
 * already adopted are skipped, so applying twice adds nothing.
 */
export function applySelection(
  choices: PackChoice[],
  existing: Category[],
  ctx: ActionContext,
  newId: () => string,
  firstSortOrder = 0,
): Change[] {
  const adopted = adoptedPackIds(existing);
  const changes: Change[] = [];
  let order = firstSortOrder;
  for (const pack of STARTER_PACKS) {
    const choice = choices.find((c) => c.packId === pack.id);
    if (!choice || adopted.has(pack.id)) continue;
    const provenance = { sourceTemplateId: pack.id, sourceTemplateVersion: pack.version, adoptedAt: ctx.now };
    const base = { userId: ctx.userId, createdAt: ctx.now, updatedAt: ctx.now, deletedAt: null };
    const categoryId = newId();
    changes.push({
      entity: "categories",
      row: categorySchema.parse({ id: categoryId, ...base, ...pack.category, sortOrder: order++, archivedAt: null, ...provenance }),
    });
    const makeItem = (spec: PackItem, tracking: Tracking, sortOrder: number, parentId: string | null, schedule: Schedule): Item =>
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
        tracking: spec.type === "group" ? { v: 1, kind: "check" } : tracking,
        schedule,
        meta: {},
        groupGoalId: null,
        sortOrder,
        archivedAt: null,
        ...provenance,
      });
    const picked = [...choice.items].sort((a, b) => a.index - b.index);
    picked.forEach(({ index, target }, sortOrder) => {
      const spec = pack.items[index];
      if (!spec) return;
      if (spec.prayerSet) {
        changes.push(...createPrayerSet(ctx, newId, { categoryId, sortOrder, provenance }));
        return;
      }
      const schedule = spec.schedule ?? daily;
      const parent = makeItem(spec, tuned(spec, target), sortOrder, null, schedule);
      changes.push({ entity: "items", row: parent });
      (spec.children ?? []).forEach((title, j) => {
        changes.push({ entity: "items", row: makeItem({ type: "habit", title }, { v: 1, kind: "check" }, j, parent.id, schedule) });
      });
    });
  }
  return changes;
}

/** Every suggested item of each pack (the API's one-call apply). */
export function applyPacks(packIds: string[], existing: Category[], ctx: ActionContext, newId: () => string, firstSortOrder = 0): Change[] {
  const choices = packIds.flatMap((packId) => {
    const pack = packById(packId);
    return pack ? [{ packId, items: pack.items.map((_, index) => ({ index })) }] : [];
  });
  return applySelection(choices, existing, ctx, newId, firstSortOrder);
}
