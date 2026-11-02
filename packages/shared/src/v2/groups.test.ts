import { describe, expect, it } from "vitest";
import { awardDef, goalDraftSchema, goalRange, goalStatus, goalValue, groupScore, groupStreak } from "../index.js";

const K = { timezone: "Asia/Karachi", dayEndHour: 0 };

describe("group goals (SOC-03)", () => {
  it("a goal runs from today to the period's end, or custom dates", () => {
    expect(goalRange({ period: "week" }, "2026-10-14", 1)).toEqual({ from: "2026-10-14", to: "2026-10-18" });
    expect(goalRange({ period: "month" }, "2026-10-14", 1)).toEqual({ from: "2026-10-14", to: "2026-10-31" });
    expect(goalRange({ period: "custom", from: "2026-11-01", to: "2026-11-10" }, "2026-10-14", 1)).toEqual({ from: "2026-11-01", to: "2026-11-10" });
  });

  it("a member's amount: done days for ticks, the sum for counts and minutes (only inside the period)", () => {
    const e = [
      { date: "2026-10-13", status: "done", value: 9000 },
      { date: "2026-10-14", status: "done", value: 12000 },
      { date: "2026-10-15", status: "in_progress", value: 4000 },
    ];
    expect(goalValue("quantity", e, "2026-10-14", "2026-10-18")).toBe(16000);
    expect(goalValue("check", e, "2026-10-13", "2026-10-18")).toBe(2);
  });

  it("each: everyone reaches it; together: the sum does", () => {
    expect(goalStatus("each", 70000, [72000, 65000])).toEqual({ total: 1, met: false });
    expect(goalStatus("each", 70000, [72000, 70000])).toEqual({ total: 2, met: true });
    expect(goalStatus("together", 70000, [40000, 31000])).toEqual({ total: 71000, met: true });
  });

  it("validation: a count needs a unit, custom needs dates, ticks are whole days", () => {
    expect(goalDraftSchema.safeParse({ title: "Steps", mode: "each", tracking: "quantity", target: 70000, period: "week" }).success).toBe(false);
    expect(goalDraftSchema.safeParse({ title: "Steps", mode: "each", tracking: "quantity", unit: "steps", target: 70000, period: "week" }).success).toBe(true);
    expect(goalDraftSchema.safeParse({ title: "Read", mode: "each", tracking: "check", target: 5, period: "custom", from: "2026-10-20" }).success).toBe(false);
    expect(goalDraftSchema.safeParse({ title: "Read", mode: "each", tracking: "check", target: 2.5, period: "week" }).success).toBe(false);
  });
});

describe("group score and streak", () => {
  it("average points per active member", () => {
    expect(groupScore([120, 80, 0])).toEqual({ average: 100, active: 2 });
    expect(groupScore([0, 0])).toEqual({ average: 0, active: 0 });
  });

  it("a group streak counts days every member snapped; today never breaks it", () => {
    const days = new Map([
      ["2026-10-13", 3],
      ["2026-10-14", 3],
      ["2026-10-15", 3],
      ["2026-10-16", 2],
    ]);
    const s = groupStreak(days, 3, "2026-10-16", new Date("2026-10-16T21:30:00+05:00"), K);
    expect(s).toMatchObject({ count: 3, todayDone: false, snappedToday: 2, atRisk: true });
    expect(groupStreak(days, 1, "2026-10-16", new Date(), K).count).toBe(0); // a group of one has no streak
  });

  it("group awards", () => {
    expect(awardDef("group_goal:abc")?.title).toBe("Group goal met");
    expect(awardDef("podium:group:week:2026-10-05:1")?.description).toBe("Your group came 1st among groups, week of 5 Oct.");
    expect(awardDef("group_streak_7")?.title).toBe("7-day group streak");
  });
});
