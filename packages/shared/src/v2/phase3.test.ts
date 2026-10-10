import { describe, expect, it } from "vitest";
import {
  applyPacks,
  archiveCategory,
  buildDay,
  categorySchema,
  createCategory,
  createItem,
  deleteCategory,
  entryState,
  isDueOn,
  itemHistory,
  itemSchema,
  moveCategory,
  moveTo,
  occurrenceSchema,
  pinItem,
  saveChildren,
  setDuration,
  setQuantity,
  sortItems,
  STARTER_PACKS,
  toggleChecklistStep,
  toggleDone,
  unarchiveCategory,
  updateItem,
  type ActionContext,
  type Category,
  type Change,
  type Item,
  type ItemDraft,
  type Occurrence,
} from "./index.js";

const U = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
const NOW = "2026-10-09T10:00:00.000Z";
const ctx: ActionContext = { userId: U, now: NOW, deviceId: "dev-1" };
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function category(over: Partial<Category> = {}): Category {
  return { ...(createCategory(uid(), { name: "Physical", icon: "dumbbell", color: "mint" }, 0, ctx)[0].row as Category), ...over };
}

const draft = (over: Partial<ItemDraft> = {}): ItemDraft => ({
  type: "habit",
  title: "Steps",
  categoryId: null,
  priority: "medium",
  isOptional: false,
  notes: null,
  tracking: { v: 1, kind: "check" },
  schedule: { v: 1, kind: "daily" },
  ...over,
});

function newItem(over: Partial<ItemDraft> = {}, extra: Partial<Item> = {}): Item {
  return { ...(createItem(uid(), draft(over), 0, { ...ctx, now: "2026-10-01T08:00:00.000Z" })[0].row as Item), ...extra };
}

/** Applies changes like the store does (upsert by id). */
function apply(state: { categories: Category[]; items: Item[]; occs: Occurrence[] }, changes: Change[]) {
  for (const c of changes) {
    const list: { id: string }[] = c.entity === "categories" ? state.categories : c.entity === "items" ? state.items : state.occs;
    const at = list.findIndex((r) => r.id === c.row.id);
    if (at >= 0) list[at] = c.row;
    else list.push(c.row);
  }
}

function validRows(changes: Change[]) {
  for (const c of changes) {
    const schema = c.entity === "categories" ? categorySchema : c.entity === "items" ? itemSchema : occurrenceSchema;
    expect(() => schema.parse(c.row)).not.toThrow();
  }
}

describe("categories", () => {
  it("reorders with up/down and only rewrites rows that moved", () => {
    const list = [0, 1, 2].map((i) => ({ ...category(), sortOrder: i, name: `C${i}` }));
    const changes = moveCategory(list, list[2].id, -1, ctx);
    expect(changes.map((c) => [(c.row as Category).name, (c.row as Category).sortOrder])).toEqual([
      ["C2", 1],
      ["C1", 2],
    ]);
    expect(moveCategory(list, list[0].id, -1, ctx)).toEqual([]);
  });

  it("archiving hides the category's items everywhere; unarchive restores exactly those", () => {
    const c = category();
    const state = { categories: [c], items: [newItem({ categoryId: c.id }), newItem({ categoryId: c.id }, { archivedAt: "2026-09-01T00:00:00.000Z" })], occs: [] as Occurrence[] };
    apply(state, archiveCategory(c, state.items, ctx));
    expect(state.items.every((i) => i.archivedAt)).toBe(true);
    expect(buildDay(state.items, [], "2026-10-09")).toEqual([]);
    apply(state, unarchiveCategory(state.categories[0], state.items, { ...ctx, now: "2026-10-10T10:00:00.000Z" }));
    expect(state.items.map((i) => i.archivedAt)).toEqual([null, "2026-09-01T00:00:00.000Z"]);
  });

  it("deleting moves its items to No category", () => {
    const c = category();
    const items = [newItem({ categoryId: c.id })];
    const changes = deleteCategory(c, items, ctx);
    validRows(changes);
    expect((changes[0].row as Category).deletedAt).toBe(NOW);
    expect((changes[1].row as Item).categoryId).toBeNull();
  });
});

describe("item editor", () => {
  it("weekdays [Mon, Wed, Fri] is due only on those days", () => {
    const it = newItem({ schedule: { v: 1, kind: "weekdays", weekdays: [1, 3, 5] } });
    const week = ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"];
    expect(week.filter((d) => isDueOn(it, d))).toEqual(["2026-10-05", "2026-10-07", "2026-10-09"]);
  });

  it("rejects a task that repeats and a habit that happens once", () => {
    expect(() => createItem(uid(), draft({ type: "task" }), 0, ctx)).toThrow();
    expect(() => createItem(uid(), draft({ schedule: { v: 1, kind: "once", date: "2026-10-09" } }), 0, ctx)).toThrow();
  });

  it("routine sub-items are created, renamed, reordered and removed; they follow the parent", () => {
    const parent = newItem({ type: "group", title: "Gym — Push day", schedule: { v: 1, kind: "weekdays", weekdays: [1, 3, 5] } });
    const state = { categories: [], items: [parent], occs: [] as Occurrence[] };
    const first = saveChildren(parent, state.items, ["Bench", "OHP", "Dips"].map((title) => ({ title })), ctx, uid);
    validRows(first);
    apply(state, first);
    const kids = state.items.filter((i) => i.parentId === parent.id);
    expect(kids.map((k) => [k.title, k.sortOrder, k.schedule.kind])).toEqual([
      ["Bench", 0, "weekdays"],
      ["OHP", 1, "weekdays"],
      ["Dips", 2, "weekdays"],
    ]);
    apply(state, saveChildren(parent, state.items, [{ id: kids[2].id, title: "Weighted dips" }, { id: kids[0].id, title: "Bench" }], ctx, uid));
    const live = state.items.filter((i) => i.parentId === parent.id && !i.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder);
    expect(live.map((k) => k.title)).toEqual(["Weighted dips", "Bench"]);
    const changes = updateItem(parent, draft({ type: "group", title: "Push", schedule: { v: 1, kind: "daily" } }), state.items, ctx);
    apply(state, changes);
    expect(state.items.filter((i) => i.parentId === parent.id && !i.deletedAt).every((k) => k.schedule.kind === "daily")).toBe(true);
  });

  it("ticking every sub-item completes the routine", async () => {
    const parent = newItem({ type: "group", title: "Gym" });
    const state = { categories: [], items: [parent], occs: [] as Occurrence[] };
    apply(state, saveChildren(parent, state.items, [1, 2, 3, 4, 5].map((i) => ({ title: `Ex ${i}` })), ctx, uid));
    const day = "2026-10-09";
    for (let i = 0; i < 5; i++) {
      const group = buildDay(state.items, state.occs, day)[0];
      expect(entryState(group)).toBe(i === 0 ? "todo" : "in_progress");
      apply(state, await toggleDone(group.children![i], day, ctx));
    }
    expect(entryState(buildDay(state.items, state.occs, day)[0])).toBe("done");
  });

  it("moving a one-off routine moves its sub-items too", async () => {
    const parent = newItem({ type: "group", title: "Move house", schedule: { v: 1, kind: "once", date: "2026-10-09" } });
    const state = { categories: [], items: [parent], occs: [] as Occurrence[] };
    apply(state, saveChildren(parent, state.items, [{ title: "Pack" }, { title: "Van" }], ctx, uid));
    const group = buildDay(state.items, state.occs, "2026-10-09")[0];
    apply(state, await moveTo(group, "2026-10-09", "2026-10-11", ctx));
    expect(buildDay(state.items, state.occs, "2026-10-11")[0].children).toHaveLength(2);
  });

  it("pins sort first", () => {
    const a = newItem({ title: "A" }, { sortOrder: 0 });
    const b = { ...newItem({ title: "B" }, { sortOrder: 1 }) };
    const pinned = pinItem(b, true, ctx)[0].row as Item;
    expect(sortItems([a, pinned]).map((i) => i.title)).toEqual(["B", "A"]);
    expect((pinItem(pinned, false, ctx)[0].row as Item).meta.pinned).toBeUndefined();
  });
});

describe("tracking kinds", () => {
  const day = "2026-10-09";

  it("steps: +500 twice, then typing 10000 completes it", async () => {
    const steps = newItem({ tracking: { v: 1, kind: "quantity", unit: "steps", target: 10000, step: 500 } });
    const state = { categories: [], items: [steps], occs: [] as Occurrence[] };
    const entry = () => buildDay(state.items, state.occs, day)[0];
    apply(state, await setQuantity(entry(), day, 500, ctx));
    apply(state, await setQuantity(entry(), day, 1000, ctx));
    expect(entryState(entry())).toBe("in_progress");
    apply(state, await setQuantity(entry(), day, 10000, ctx));
    expect(entryState(entry())).toBe("done");
  });

  it("checklist: some steps → in progress, all → done, toggle clears", async () => {
    const it = newItem({ tracking: { v: 1, kind: "checklist", steps: ["Script", "Shoot", "Edit"] } });
    const state = { categories: [], items: [it], occs: [] as Occurrence[] };
    const entry = () => buildDay(state.items, state.occs, day)[0];
    apply(state, await toggleChecklistStep(entry(), day, 1, ctx));
    expect(entryState(entry())).toBe("in_progress");
    apply(state, await toggleChecklistStep(entry(), day, 0, ctx));
    apply(state, await toggleChecklistStep(entry(), day, 2, ctx));
    expect(entryState(entry())).toBe("done");
    validRows(await toggleDone(entry(), day, ctx));
    apply(state, await toggleDone(entry(), day, ctx));
    expect(entryState(entry())).toBe("todo");
    expect(state.occs[0].detail).toEqual({ steps: [false, false, false] });
  });

  it("duration: minutes up to the target", async () => {
    const it = newItem({ tracking: { v: 1, kind: "duration", targetMin: 20 } });
    const state = { categories: [], items: [it], occs: [] as Occurrence[] };
    const entry = () => buildDay(state.items, state.occs, day)[0];
    apply(state, await setDuration(entry(), day, 15, ctx));
    expect(entryState(entry())).toBe("in_progress");
    apply(state, await setDuration(entry(), day, 20, ctx));
    expect(entryState(entry())).toBe("done");
  });
});

describe("history", () => {
  const occ = (item: Item, date: string, status: Occurrence["status"]): Occurrence => ({
    id: uid(),
    userId: U,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    itemId: item.id,
    date,
    slot: "",
    status,
    value: null,
    detail: null,
    movedTo: null,
    movedFrom: null,
    startedAt: null,
    completedAt: null,
    deviceId: null,
  });

  it("marks days, skips don't break streaks, today unfinished doesn't either", () => {
    const it = newItem();
    const occs = [
      occ(it, "2026-10-02", "done"),
      occ(it, "2026-10-03", "done"),
      occ(it, "2026-10-04", "done"),
      // 10-05 missed
      occ(it, "2026-10-06", "done"),
      occ(it, "2026-10-07", "skipped"),
      occ(it, "2026-10-08", "done"),
    ];
    const h = itemHistory(it, [], occs, "2026-09-30", "2026-10-11", "2026-10-09");
    const mark = (d: string) => h.days.find((x) => x.date === d)?.mark;
    expect(mark("2026-09-30")).toBe("not_due"); // before it existed
    expect(mark("2026-10-01")).toBe("missed");
    expect(mark("2026-10-05")).toBe("missed");
    expect(mark("2026-10-07")).toBe("skipped");
    expect(mark("2026-10-09")).toBe("today");
    expect(mark("2026-10-10")).toBe("future");
    expect(h.currentStreak).toBe(2);
    expect(h.bestStreak).toBe(3);
    expect(h.done).toBe(5);
    expect(h.completionRate).toBe(Math.round((5 / 7) * 100));
  });

  it("weekday habits only count their days; archived items stop counting", () => {
    const it = newItem({ schedule: { v: 1, kind: "weekdays", weekdays: [1, 3, 5] } }, { archivedAt: "2026-10-07T12:00:00.000Z" });
    const h = itemHistory(it, [], [occ(it, "2026-10-05", "done")], "2026-10-01", "2026-10-09", "2026-10-09");
    expect(h.days.filter((d) => d.mark !== "not_due").map((d) => [d.date, d.mark])).toEqual([
      ["2026-10-02", "missed"],
      ["2026-10-05", "done"],
      ["2026-10-07", "missed"],
    ]);
  });
});

describe("starter packs", () => {
  it("has stable unique ids and valid rows", () => {
    expect(new Set(STARTER_PACKS.map((p) => p.id)).size).toBe(STARTER_PACKS.length);
    const changes = applyPacks(STARTER_PACKS.map((p) => p.id), [], ctx, uid);
    validRows(changes);
    expect(changes.filter((c) => c.entity === "categories")).toHaveLength(STARTER_PACKS.length);
  });

  it("applies only the chosen packs, with provenance, and is idempotent", () => {
    const [spiritual, physical] = STARTER_PACKS;
    const state = { categories: [] as Category[], items: [] as Item[], occs: [] as Occurrence[] };
    apply(state, applyPacks([spiritual.id, physical.id], state.categories, ctx, uid));
    expect(state.categories.map((c) => c.name)).toEqual(["Spiritual", "Physical"]);
    expect(state.items.every((i) => i.sourceTemplateId && i.adoptedAt === NOW)).toBe(true);
    const gym = state.items.find((i) => i.title === "Gym — Push day")!;
    expect(state.items.filter((i) => i.parentId === gym.id)).toHaveLength(5);
    expect(applyPacks([spiritual.id], state.categories, ctx, uid)).toEqual([]);
  });
});
