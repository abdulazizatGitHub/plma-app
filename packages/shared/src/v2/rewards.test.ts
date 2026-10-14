import { describe, expect, it } from "vitest";
import {
  BADGES,
  badgeProgress,
  buildDay,
  createPrayerSet,
  levelOf,
  rewardsSummary,
  scoreDay,
  streakOf,
  toggleDone,
  unitPoints,
  type ActionContext,
  type Item,
  type Occurrence,
  type RewardDay,
} from "../index.js";

const U = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
const NOW = "2026-10-12T10:00:00.000Z";
const S = { timezone: "Asia/Karachi", dayEndHour: 0 };
const ctx: ActionContext = { userId: U, now: NOW, deviceId: null };
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const CREATED = "2026-09-01T08:00:00.000Z";

const item = (over: Partial<Item>): Item => ({
  id: uid(), userId: U, createdAt: CREATED, updatedAt: CREATED, deletedAt: null, categoryId: null, parentId: null, type: "habit", title: "Item", notes: null,
  priority: "medium", isOptional: false, tracking: { v: 1, kind: "check" }, schedule: { v: 1, kind: "daily" }, meta: {}, groupGoalId: null, sortOrder: 0,
  archivedAt: null, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null, ...over,
});
const occ = (it: Item, date: string, status: Occurrence["status"], detail: Record<string, unknown> | null = null, updatedAt = `${date}T12:00:00.000Z`, value: number | null = null): Occurrence => ({
  id: uid(), userId: U, createdAt: updatedAt, updatedAt, deletedAt: null, itemId: it.id, date, slot: "", status, value, detail,
  movedTo: null, movedFrom: null, startedAt: null, completedAt: status === "done" ? updatedAt : null, deviceId: null,
});

const read = item({ title: "Read", priority: "low" });
const gym = item({ title: "Gym", priority: "high" });
const bill = item({ title: "Bill", priority: "critical", type: "task", schedule: { v: 1, kind: "once", date: "2026-10-12" } });
const journal = item({ title: "Journal", priority: "medium", isOptional: true });
const steps = item({ title: "Steps", priority: "medium", tracking: { v: 1, kind: "quantity", unit: "steps", target: 1000, step: 500 } });

describe("points (REW-01)", () => {
  it("by priority; qada half rounded up; late fixes earn nothing", () => {
    expect(unitPoints(read, occ(read, "2026-10-12", "done"), true)).toBe(1);
    expect(unitPoints(bill, occ(bill, "2026-10-12", "done"), true)).toBe(5);
    expect(unitPoints(gym, occ(gym, "2026-10-12", "done", { qada: true }), true)).toBe(2); // 3 → 1.5 → 2
    expect(unitPoints(gym, occ(gym, "2026-10-12", "done", { late: true }), true)).toBe(0);
    expect(unitPoints(gym, occ(gym, "2026-10-12", "in_progress"), false)).toBe(0);
  });

  it("a day: items + the perfect-day bonus; optional items add points but aren't required", () => {
    const day = "2026-10-12";
    const occs = [occ(read, day, "done"), occ(gym, day, "done"), occ(bill, day, "done"), occ(journal, day, "done"), occ(steps, day, "done", { target: 1000 }, undefined, 1000)];
    expect(scoreDay([read, gym, bill, journal, steps], occs, day, false, S)).toEqual({
      date: day, due: 4, done: 4, complete: true, perfect: true, allPrayers: null, points: 1 + 3 + 5 + 2 + 2 + 10,
    });
  });

  it("going past the goal earns nothing extra", () => {
    const day = "2026-10-12";
    const a = scoreDay([steps], [occ(steps, day, "done", { target: 1000 }, undefined, 1000)], day, false, S).points;
    const b = scoreDay([steps], [occ(steps, day, "done", { target: 1000 }, undefined, 9000)], day, false, S).points;
    expect(b).toBe(a);
  });

  it("a day finished with a late fix is complete (streak) but not perfect (no bonus)", () => {
    const day = "2026-10-11";
    const d = scoreDay([read, gym], [occ(read, day, "done"), occ(gym, day, "done", { late: true }, "2026-10-12T09:00:00.000Z")], day, false, S);
    expect(d).toMatchObject({ complete: true, perfect: false, points: 1 });
  });

  it("toggling done/undone any number of times leaves the score unchanged; replaying rows too", async () => {
    const day = "2026-10-12";
    const base = scoreDay([read, gym], [occ(gym, day, "done")], day, false, S);
    let rows: Occurrence[] = [occ(gym, day, "done")];
    for (let i = 0; i < 5; i++) {
      const entry = buildDay([read, gym], rows, day).find((e) => e.item.id === read.id)!;
      const [c] = await toggleDone(entry, day, { ...ctx, today: day });
      rows = [...rows.filter((o) => o.itemId !== read.id), c.row as Occurrence];
    }
    // Five toggles: done, undone, done, undone, done.
    const after = scoreDay([read, gym], rows, day, false, S);
    expect(after.points).toBe(base.points + 1 + 10);
    expect(scoreDay([read, gym], [...rows, ...rows], day, false, S)).toEqual(after); // a replayed sync
  });

  it("prayers: all five prayed (qada counts); a prayer recovered after the day closed doesn't count for streaks", () => {
    const set = createPrayerSet({ userId: U, now: CREATED, deviceId: null }, uid, { categoryId: null }).map((c) => c.row as unknown as Item);
    const prayers = set.filter((p) => p.parentId);
    const day = "2026-10-05";
    const on = prayers.map((p, i) => occ(p, day, "done", i === 0 ? { qada: true } : null));
    expect(scoreDay(set, on, day, true, S)).toMatchObject({ allPrayers: true, complete: true, perfect: true });
    const recovered = prayers.map((p, i) => (i === 0 ? occ(p, day, "done", { qada: true, late: true }, "2026-10-12T09:00:00.000Z") : occ(p, day, "done")));
    expect(scoreDay(set, recovered, day, true, S)).toMatchObject({ allPrayers: false, complete: false, perfect: false });
  });
});

const days = (from: string, flags: string): RewardDay[] =>
  [...flags].map((f, i) => {
    const [y, m, d] = from.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
    const complete = f === "Y" || f === "P";
    return { date, due: f === "-" ? 0 : 3, done: complete ? 3 : 1, complete, perfect: f === "P", allPrayers: f === "-" ? null : complete, points: complete ? 6 : 2 };
  });

describe("streaks and freezes (REW-02)", () => {
  it("7 days earn a freeze; missing day 8 uses it and the streak continues", () => {
    const s = streakOf(days("2026-09-01", "YYYYYYYNY"), "2026-09-09", "2026-09-09");
    expect(s).toMatchObject({ current: 8, best: 8, freezes: 0, freezeUsedOn: ["2026-09-08"] });
  });

  it("a second miss with no freeze left restarts gently; the best is kept", () => {
    const s = streakOf(days("2026-09-01", "YYYYYYYNNYY"), "2026-09-11", "2026-09-11");
    expect(s).toMatchObject({ current: 2, best: 7, freezes: 0, restartedAfter: ["2026-09-09"] });
  });

  it("free days are neutral; freezes cap at 2", () => {
    expect(streakOf(days("2026-09-01", "YY-Y-Y"), "2026-09-06", "2026-09-06").current).toBe(4);
    expect(streakOf(days("2026-09-01", "Y".repeat(28)), "2026-09-28", "2026-09-28").freezes).toBe(2);
  });

  it("open days add on once complete and never break it", () => {
    const d = days("2026-09-01", "YYYNY"); // the last two are still open
    expect(streakOf(d, "2026-09-03", "2026-09-05")).toMatchObject({ current: 4, provisional: 1 });
  });
});

describe("levels and badges (REW-03/04)", () => {
  it("level n starts at 50·n·(n−1)", () => {
    expect(levelOf(0)).toEqual({ level: 1, start: 0, next: 100 });
    expect(levelOf(99).level).toBe(1);
    expect(levelOf(100)).toEqual({ level: 2, start: 100, next: 300 });
    expect(levelOf(650)).toEqual({ level: 4, start: 600, next: 1000 });
  });

  it("badges come from closed days only; locked ones show how far along you are", () => {
    const d = days("2026-09-07", "PPPPPPPYY"); // Mon 7 Sep: a perfect Mon–Sun week
    const earned = (closedThrough: string, plansFinished = 0) =>
      badgeProgress(d, closedThrough, { weekStart: 1, plansFinished }).filter((b) => b.earned).map((b) => b.id);
    expect(earned("2026-09-15", 1)).toEqual(["streak_3", "streak_7", "prayers_week", "perfect_week", "first_plan"]);
    expect(earned("2026-09-09")).toEqual(["streak_3"]); // the week isn't over yet
    expect(badgeProgress(d, "2026-09-15", { weekStart: 1, plansFinished: 0 }).find((b) => b.id === "streak_30")).toMatchObject({ have: 9, need: 30 });
    expect(BADGES.map((b) => b.id)).toHaveLength(7);
  });

  it("summary: total, level, today and this week", () => {
    const d = days("2026-09-07", "PPY");
    const s = rewardsSummary(d, { closedThrough: "2026-09-08", today: "2026-09-09", weekStart: 1 });
    expect(s).toMatchObject({ points: 18, level: 1, todayPoints: 6, weekPoints: 18, streak: { current: 3 } });
  });
});
