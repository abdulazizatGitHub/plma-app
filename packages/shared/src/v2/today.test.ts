import { describe, expect, it } from "vitest";
import {
  bringBack,
  buildDay,
  createTask,
  dayAccess,
  dayStreak,
  dayProgress,
  describeSchedule,
  entryState,
  isDueOn,
  logicalToday,
  nextDayEnd,
  itemSchema,
  moveTo,
  occurrenceIdFor,
  occurrenceSchema,
  pendingItems,
  setQuantity,
  skip,
  start,
  toggleDone,
  type ActionContext,
  type Change,
  type Item,
  type Occurrence,
  type Schedule,
} from "./index.js";

const U = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
const NOW = "2026-10-09T10:00:00.000Z";
const FRI = "2026-10-09";
const SAT = "2026-10-10";
const ctx: ActionContext = { userId: U, now: NOW, deviceId: "dev-1" };
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function item(over: Partial<Item> & { schedule?: Schedule } = {}): Item {
  return {
    id: uid(),
    userId: U,
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: NOW,
    deletedAt: null,
    categoryId: null,
    parentId: null,
    type: "habit",
    title: "Item",
    notes: null,
    priority: "medium",
    isOptional: false,
    tracking: { v: 1, kind: "check" },
    schedule: { v: 1, kind: "daily" },
    meta: {},
    groupGoalId: null,
    sortOrder: 0,
    archivedAt: null,
    sourceTemplateId: null,
    sourceTemplateVersion: null,
    adoptedAt: null,
    ...over,
  };
}
const task = (date: string | null, over: Partial<Item> = {}) => item({ type: "task", schedule: { v: 1, kind: "once", date }, ...over });
const steps = () => item({ title: "Steps", tracking: { v: 1, kind: "quantity", unit: "steps", target: 10000, step: 500 } });

/** Applies changes like the store does (upsert by id). */
function apply(items: Item[], occs: Occurrence[], changes: Change[]) {
  for (const c of changes) {
    const list: { id: string }[] = c.entity === "items" ? items : occs;
    const at = list.findIndex((r) => r.id === c.row.id);
    if (at >= 0) list[at] = c.row;
    else list.push(c.row);
  }
}

describe("isDueOn", () => {
  it("handles every schedule kind", () => {
    expect(isDueOn(item(), FRI)).toBe(true);
    expect(isDueOn(task(FRI), FRI)).toBe(true);
    expect(isDueOn(task(FRI), SAT)).toBe(false);
    expect(isDueOn(task(null), FRI)).toBe(false);
    const kahf = item({ schedule: { v: 1, kind: "weekdays", weekdays: [5] } });
    expect([isDueOn(kahf, FRI), isDueOn(kahf, SAT)]).toEqual([true, false]);
    const everyThird = item({ schedule: { v: 1, kind: "everyNDays", n: 3, activeFrom: "2026-10-01" } });
    expect(["2026-10-01", "2026-10-02", "2026-10-04", "2026-10-07"].map((d) => isDueOn(everyThird, d))).toEqual([true, false, true, true]);
  });

  it("clamps monthly days to the month end and respects active ranges", () => {
    const rent = item({ schedule: { v: 1, kind: "monthly", monthDay: 31 } });
    expect([isDueOn(rent, "2026-02-28"), isDueOn(rent, "2026-03-30"), isDueOn(rent, "2026-03-31")]).toEqual([true, false, true]);
    const ranged = item({ schedule: { v: 1, kind: "daily", activeFrom: "2026-10-05", activeUntil: "2026-10-09" } });
    expect(["2026-10-04", "2026-10-05", FRI, SAT].map((d) => isDueOn(ranged, d))).toEqual([false, true, true, false]);
  });

  it("never shows archived or deleted items", () => {
    expect(isDueOn(item({ archivedAt: NOW }), FRI)).toBe(false);
    expect(isDueOn(item({ deletedAt: NOW }), FRI)).toBe(false);
  });

  it("describes schedules for captions", () => {
    expect(describeSchedule(item({ schedule: { v: 1, kind: "weekdays", weekdays: [5], anchor: { type: "prayer", prayer: "dhuhr", relation: "after", offsetMin: 0 } } }))).toBe("Fridays · after dhuhr");
    expect(describeSchedule(item())).toBeNull();
  });
});

describe("buildDay and dayProgress", () => {
  it("merges virtual and stored occurrences; quantity 4,000/10,000 is In Progress", async () => {
    const s = steps();
    const items = [s, item({ title: "Make bed" })];
    const occs: Occurrence[] = [];
    let day = buildDay(items, occs, FRI);
    expect(day.map((e) => e.occurrence)).toEqual([null, null]);
    apply(items, occs, await setQuantity(day[0], FRI, 4000, ctx));
    day = buildDay(items, occs, FRI);
    expect(entryState(day[0])).toBe("in_progress");
    expect(dayProgress(day)).toMatchObject({ required: 2, done: 0, counts: { todo: 1, in_progress: 1, done: 0 } });
  });

  it("reaches 100% when the rest is skipped, moved, optional or pending", async () => {
    const done = item({ title: "Done" });
    const toSkip = item({ title: "Skip" });
    const toMove = item({ title: "Move" });
    const oneOff = task(FRI, { title: "Pend" });
    const optional = item({ title: "Optional", isOptional: true });
    const items = [done, toSkip, toMove, oneOff, optional];
    const occs: Occurrence[] = [];
    const at = (title: string) => buildDay(items, occs, FRI).find((e) => e.item.title === title)!;
    apply(items, occs, await toggleDone(at("Done"), FRI, ctx));
    apply(items, occs, await skip(at("Skip"), FRI, ctx));
    apply(items, occs, await moveTo(at("Move"), FRI, SAT, ctx));
    apply(items, occs, await moveTo(at("Pend"), FRI, null, ctx));
    const progress = dayProgress(buildDay(items, occs, FRI));
    expect(progress).toMatchObject({ required: 1, done: 1, pct: 100 });
    expect(pendingItems(items).map((i) => i.title)).toEqual(["Pend"]);
  });

  it("shows 100% when nothing is required", () => {
    expect(dayProgress(buildDay([], [], FRI))).toMatchObject({ required: 0, pct: 100 });
  });

  it("counts group children, not the group itself (prayers)", async () => {
    const group = item({ type: "group", title: "Daily prayers", meta: { prayerSet: true } });
    const kids = ["Fajr", "Zuhr", "Asr", "Maghrib", "Isha"].map((t, i) => item({ title: t, parentId: group.id, sortOrder: i }));
    const items = [group, ...kids];
    const occs: Occurrence[] = [];
    const day = buildDay(items, occs, FRI);
    expect(day).toHaveLength(1);
    expect(day[0].children?.map((c) => c.item.title)).toEqual(["Fajr", "Zuhr", "Asr", "Maghrib", "Isha"]);
    // Any order: Asr before Fajr.
    apply(items, occs, await toggleDone(day[0].children![2], FRI, ctx));
    const after = buildDay(items, occs, FRI);
    expect(entryState(after[0])).toBe("in_progress");
    expect(dayProgress(after)).toMatchObject({ required: 5, done: 1, pct: 20, counts: { todo: 0, in_progress: 0, done: 0 } });
  });

  it("counts a routine as one row in the tiles, and its sub-items in the %", () => {
    const gym = item({ type: "group", title: "Gym" });
    const kids = ["Bench", "OHP"].map((t, i) => item({ title: t, parentId: gym.id, sortOrder: i }));
    const day = buildDay([gym, ...kids], [], FRI);
    expect(dayProgress(day)).toMatchObject({ required: 2, done: 0, counts: { todo: 1, in_progress: 0, done: 0 } });
  });
});

describe("actions", () => {
  it("moves a one-off task by changing its date, and pending clears it", async () => {
    const t = task(FRI);
    const items = [t];
    const occs: Occurrence[] = [];
    apply(items, occs, await start(buildDay(items, occs, FRI)[0], FRI, ctx));
    apply(items, occs, await moveTo(buildDay(items, occs, FRI)[0], FRI, SAT, ctx));
    expect(buildDay(items, occs, FRI)).toHaveLength(0);
    const sat = buildDay(items, occs, SAT);
    expect(sat).toHaveLength(1);
    expect(entryState(sat[0])).toBe("in_progress"); // its occurrence moved with it
  });

  it("moves one instance of a repeating item into a separate slot on the target day", async () => {
    const gym = item({ title: "Gym" });
    const items = [gym];
    const occs: Occurrence[] = [];
    apply(items, occs, await moveTo(buildDay(items, occs, FRI)[0], FRI, SAT, ctx));
    expect(entryState(buildDay(items, occs, FRI)[0])).toBe("not_today");
    const sat = buildDay(items, occs, SAT);
    expect(sat.map((e) => e.slot)).toEqual(["", `moved:${FRI}`]);
    expect(sat[1].occurrence?.movedFrom).toBe(FRI);
    await expect(moveTo(buildDay(items, occs, SAT)[0], SAT, null, ctx)).rejects.toThrow(/one-off/);
  });

  it("brings back a skipped item and toggles done back off", async () => {
    const it = item();
    const items = [it];
    const occs: Occurrence[] = [];
    apply(items, occs, await skip(buildDay(items, occs, FRI)[0], FRI, ctx));
    apply(items, occs, await bringBack(buildDay(items, occs, FRI)[0], FRI, ctx));
    expect(entryState(buildDay(items, occs, FRI)[0])).toBe("todo");
    apply(items, occs, await toggleDone(buildDay(items, occs, FRI)[0], FRI, ctx));
    apply(items, occs, await toggleDone(buildDay(items, occs, FRI)[0], FRI, ctx));
    expect(entryState(buildDay(items, occs, FRI)[0])).toBe("todo");
  });

  it("keeps an optional time on dated tasks and drops it for pending ones", () => {
    const [timed] = createTask(uid(), { title: "Shoot", date: SAT, time: "23:00", categoryId: null, priority: "high" }, 1, ctx);
    expect((timed.row as Item).schedule).toEqual({ v: 1, kind: "once", date: SAT, time: "23:00" });
    const [pending] = createTask(uid(), { title: "Later", date: null, time: "23:00", categoryId: null, priority: "low" }, 2, ctx);
    expect((pending.row as Item).schedule).toEqual({ v: 1, kind: "once", date: null });
    expect(itemSchema.safeParse(timed.row).success).toBe(true);
  });

  it("produces rows that pass the sync schemas", async () => {
    const [created] = createTask(uid(), { title: "  Quiz  ", date: SAT, categoryId: null, priority: "critical" }, 3, ctx);
    expect(itemSchema.parse(created.row).title).toBe("Quiz");
    const [o] = await toggleDone(buildDay([created.row as Item], [], SAT)[0], SAT, ctx);
    expect(occurrenceSchema.safeParse(o.row).success).toBe(true);
  });
});

describe("occurrenceIdFor", () => {
  it("is deterministic per (item, date, slot) and a valid UUID", async () => {
    const a = await occurrenceIdFor("item-1", FRI);
    expect(a).toBe(await occurrenceIdFor("item-1", FRI, ""));
    expect(a).not.toBe(await occurrenceIdFor("item-1", SAT));
    expect(a).not.toBe(await occurrenceIdFor("item-1", FRI, `moved:${SAT}`));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("day lock", () => {
  it("keeps the previous day until the user's day-end hour", () => {
    expect(logicalToday(0, new Date(2026, 9, 12, 0, 30))).toBe("2026-10-12");
    expect(logicalToday(2, new Date(2026, 9, 12, 1, 30))).toBe("2026-10-11");
    expect(logicalToday(2, new Date(2026, 9, 12, 2, 0))).toBe("2026-10-12");
    expect(logicalToday(9, new Date(2026, 9, 12, 4, 30))).toBe("2026-10-12"); // clamped to 4 AM
  });

  it("finds the next boundary", () => {
    expect(nextDayEnd(0, new Date(2026, 9, 11, 23, 0))).toEqual(new Date(2026, 9, 12, 0, 0));
    expect(nextDayEnd(3, new Date(2026, 9, 12, 1, 0))).toEqual(new Date(2026, 9, 12, 3, 0));
    expect(nextDayEnd(3, new Date(2026, 9, 12, 9, 0))).toEqual(new Date(2026, 9, 13, 3, 0));
  });

  it("gives an ended day a 2-day correction window, then locks it", () => {
    expect(dayAccess("2026-10-12", "2026-10-12")).toBe("live");
    expect(dayAccess("2026-10-11", "2026-10-12")).toBe("late");
    expect(dayAccess("2026-10-10", "2026-10-12")).toBe("late");
    expect(dayAccess("2026-10-09", "2026-10-12")).toBe("history");
    expect(dayAccess("2026-10-13", "2026-10-12")).toBe("planned");
  });
});

describe("dayStreak", () => {
  const D = (d: number) => `2026-10-${String(d).padStart(2, "0")}`;
  async function doneOn(items: Item[], occs: Occurrence[], dates: number[]) {
    for (const d of dates) {
      const entry = buildDay(items, occs, D(d)).find((e) => e.item.id === items[0].id)!;
      apply(items, occs, await toggleDone(entry, D(d), ctx));
    }
  }

  it("counts perfect days back from today; an unfinished today doesn't break it", async () => {
    const items = [item({ title: "Read", createdAt: "2026-10-01T08:00:00.000Z" })];
    const occs: Occurrence[] = [];
    await doneOn(items, occs, [1, 2, 3, 5, 6, 7]);
    expect(dayStreak(items, occs, D(1), D(8))).toEqual({ current: 3, best: 3 });
    await doneOn(items, occs, [8]);
    expect(dayStreak(items, occs, D(1), D(8))).toEqual({ current: 4, best: 4 });
  });

  it("breaks on a missed past day; days with nothing due are neutral", async () => {
    const weekdays = item({ title: "Gym", schedule: { v: 1, kind: "weekdays", weekdays: [1] } });
    const items = [weekdays];
    const occs: Occurrence[] = [];
    // Mondays: 5th and 12th Oct 2026. Only the 12th is done.
    const entry = buildDay(items, occs, D(12)).find((e) => e.item.id === weekdays.id)!;
    apply(items, occs, await toggleDone(entry, D(12), ctx));
    expect(dayStreak(items, occs, D(1), D(14))).toEqual({ current: 1, best: 1 });
  });
});
