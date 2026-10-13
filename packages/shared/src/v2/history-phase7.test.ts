import { describe, expect, it } from "vitest";
import {
  buildDay,
  closeDay,
  editLag,
  entryState,
  itemHistory,
  periodMonth,
  periodSummary,
  periodWeek,
  previousPeriod,
  setQuantity,
  toggleDone,
  windowEnd,
  type ActionContext,
  type Category,
  type Item,
  type Occurrence,
} from "../index.js";

const U = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
const NOW = "2026-10-12T10:00:00.000Z";
const ctx: ActionContext = { userId: U, now: NOW, deviceId: null };
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const CREATED = "2026-09-28T08:00:00.000Z";

const cat = (name: string, sortOrder: number): Category =>
  ({ id: uid(), userId: U, createdAt: CREATED, updatedAt: CREATED, deletedAt: null, name, icon: "tag", color: "mint", sortOrder, archivedAt: null, remindersMuted: false, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null });
const item = (over: Partial<Item>): Item => ({
  id: uid(), userId: U, createdAt: CREATED, updatedAt: CREATED, deletedAt: null, categoryId: null, parentId: null, type: "habit", title: "Item", notes: null,
  priority: "medium", isOptional: false, tracking: { v: 1, kind: "check" }, schedule: { v: 1, kind: "daily" }, meta: {}, groupGoalId: null, sortOrder: 0,
  archivedAt: null, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null, ...over,
});
const occ = (it: Item, date: string, status: Occurrence["status"], value: number | null = null, detail: Record<string, unknown> | null = null): Occurrence => ({
  id: uid(), userId: U, createdAt: NOW, updatedAt: NOW, deletedAt: null, itemId: it.id, date, slot: "", status, value, detail,
  movedTo: null, movedFrom: null, startedAt: null, completedAt: status === "done" ? NOW : null, deviceId: null,
});

// Week Mon 5 – Sun 11 Oct 2026; today is Mon 12 Oct.
const physical = cat("Physical", 0);
const mental = cat("Mental", 1);
const steps = item({ title: "Steps", categoryId: physical.id, tracking: { v: 1, kind: "quantity", unit: "steps", target: 1000, step: 500 } });
const gym = item({ title: "Gym", categoryId: physical.id, schedule: { v: 1, kind: "weekdays", weekdays: [1, 3, 5] } });
const read = item({ title: "Read", categoryId: mental.id });
const journal = item({ title: "Journal", categoryId: mental.id, isOptional: true });
const bill = item({ title: "Pay bill", type: "task", schedule: { v: 1, kind: "once", date: "2026-10-05" } });
const items = [steps, gym, read, journal, bill];
const occurrences: Occurrence[] = [
  occ(steps, "2026-10-05", "done", 1000, { target: 1000 }),
  occ(steps, "2026-10-06", "in_progress", 500, { target: 1000 }),
  occ(steps, "2026-10-07", "skipped"),
  occ(steps, "2026-10-08", "done", 1000, { target: 1000, late: true }),
  occ(gym, "2026-10-05", "done"),
  occ(gym, "2026-10-07", "moved"),
  ...["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-11"].map((d) => occ(read, d, "done")),
];
const input = { items, occurrences, categories: [physical, mental] };
const TODAY = "2026-10-12";

describe("periodSummary (week of 5 Oct)", () => {
  const week = periodSummary(input, { ...periodWeek("2026-10-08"), today: TODAY });

  it("matches hand-computed daily percentages, average and perfect days", () => {
    expect(week.from).toBe("2026-10-05");
    expect(week.to).toBe("2026-10-11");
    expect(week.days.map((d) => d.pct)).toEqual([75, 50, 100, 100, 33, 0, 50]);
    expect(week.average).toBe(58);
    expect(week.perfectDays).toBe(2);
    expect(week.totals).toEqual({ done: 9, missed: 7, skipped: 1, moved: 1, late: 1, qada: 0 });
  });

  it("per category: rates, counts and insights (optional items never count)", () => {
    const phys = week.byCategory.find((c) => c.category?.name === "Physical")!;
    const ment = week.byCategory.find((c) => c.category?.name === "Mental")!;
    expect(phys).toMatchObject({ due: 8, done: 3, missed: 5, skipped: 1, moved: 1, late: 1, rate: 38 });
    expect(ment).toMatchObject({ due: 7, done: 6, missed: 1, rate: 86 });
    expect(week.doingWell.map((c) => c.category?.name)).toEqual(["Mental"]);
    expect(week.needsAttention.map((c) => [c.category?.name, c.mostMissed?.item.title])).toEqual([["Physical", "Steps"]]);
  });

  it("free days and today don't drag the average; today shows 'so far'", () => {
    const thisWeek = periodSummary(input, { ...periodWeek(TODAY), today: TODAY });
    expect(thisWeek.average).toBeNull(); // nothing finished yet this week
    expect(thisWeek.todaySoFar).toBe(0);
    expect(thisWeek.days.filter((d) => d.kind === "future")).toHaveLength(6);
  });

  it("periods: week start, month bounds and the previous period", () => {
    expect(periodWeek("2026-10-08", 0)).toEqual({ from: "2026-10-04", to: "2026-10-10" });
    expect(periodMonth("2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(previousPeriod({ from: "2026-10-05", to: "2026-10-11" }, "week")).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(previousPeriod(periodMonth("2026-03-15"), "month")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("history can't be rewritten", () => {
  it("closing writes missed rows for open repeating items only (not done, optional, one-offs)", async () => {
    const rows = await closeDay(items, occurrences, "2026-10-09", U, NOW);
    expect(rows.map((r) => [items.find((i) => i.id === r.itemId)?.title, r.status])).toEqual([
      ["Steps", "missed"],
      ["Gym", "missed"],
    ]);
    // Idempotent: a row exists now, so nothing new.
    expect(await closeDay(items, [...occurrences, ...rows], "2026-10-09", U, NOW)).toEqual([]);
  });

  it("a schedule edit after closing doesn't erase a missed day", async () => {
    const closed = [...occurrences, ...(await closeDay(items, occurrences, "2026-10-09", U, NOW))];
    const gymTueThu = { ...gym, schedule: { v: 1 as const, kind: "weekdays" as const, weekdays: [2, 4] } };
    const edited = items.map((i) => (i.id === gym.id ? gymTueThu : i));
    const day = (occs: Occurrence[], closedThrough: string | null) =>
      periodSummary({ ...input, items: edited, occurrences: occs }, { from: "2026-10-09", to: "2026-10-09", today: TODAY, closedThrough }).days[0];
    expect(day(closed, "2026-10-09")).toMatchObject({ required: 3, done: 1 }); // Gym's miss is kept
    expect(day(occurrences, null)).toMatchObject({ required: 2, done: 1 }); // without closing, the edit would hide it
  });

  it("a target change doesn't alter past days (the snapshot wins)", async () => {
    const entry = buildDay([steps], [], "2026-10-12")[0];
    const [c] = await setQuantity(entry, "2026-10-12", 1000, ctx);
    const row = c.row as Occurrence;
    expect(row.detail).toMatchObject({ target: 1000 });
    const raised = { ...steps, tracking: { v: 1 as const, kind: "quantity" as const, unit: "steps", target: 2000, step: 500 } };
    expect(entryState({ key: "k", item: raised, slot: "", occurrence: row })).toBe("done");
  });

  it("edits in the correction window are stamped late", async () => {
    const entry = buildDay([read], [], "2026-10-11")[0];
    const [c] = await toggleDone(entry, "2026-10-11", { ...ctx, late: true });
    expect((c.row as Occurrence).detail).toMatchObject({ late: true });
  });

  it("item history: log newest first with late, skipped and moved counts", () => {
    const h = itemHistory(steps, [], occurrences, "2026-10-05", "2026-10-11", TODAY);
    expect(h.log[0]).toMatchObject({ date: "2026-10-11", mark: "missed" });
    expect(h.log.find((l) => l.date === "2026-10-08")).toMatchObject({ mark: "done", late: true, value: 1000, target: 1000 });
    expect(h.skipped).toBe(1);
    const g = itemHistory(gym, [], occurrences, "2026-10-05", "2026-10-11", TODAY);
    expect(g.moved).toBe(1);
    expect(g.log.find((l) => l.date === "2026-10-07")).toMatchObject({ mark: "skipped", how: "moved" });
  });
});

describe("correction window maths", () => {
  it("a day stays fixable for 2 days after it ends, in the user's time zone and day-end", () => {
    expect(windowEnd("2026-10-10", "Asia/Karachi", 0)).toEqual(new Date("2026-10-13T00:00:00+05:00"));
    expect(windowEnd("2026-10-10", "Asia/Karachi", 2)).toEqual(new Date("2026-10-13T02:00:00+05:00"));
    expect(editLag("2026-10-10", new Date("2026-10-12T20:00:00+05:00"), "Asia/Karachi")).toBe(2);
    expect(editLag("2026-10-10", new Date("2026-10-13T01:00:00+05:00"), "Asia/Karachi", 2)).toBe(2);
    expect(editLag("2026-10-10", new Date("2026-10-13T00:30:00+05:00"), "Asia/Karachi")).toBe(3);
  });
});
