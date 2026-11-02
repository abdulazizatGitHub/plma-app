import { describe, expect, it } from "vitest";
import { dayEndsAt, friendStreak, timeLeft, type SnapDay } from "../index.js";

const K = { timezone: "Asia/Karachi", dayEndHour: 0 };
const days = (spec: Record<string, "both" | "me" | "them">): SnapDay[] =>
  Object.entries(spec).map(([date, who]) => ({ date, me: who !== "them", them: who !== "me" }));

describe("friend streaks (Snapchat-style)", () => {
  const noon = new Date("2026-10-16T12:00:00+05:00");

  it("counts days you both snapped; today still open doesn't break it", () => {
    const d = days({ "2026-10-13": "both", "2026-10-14": "both", "2026-10-15": "both", "2026-10-16": "me" });
    expect(friendStreak(d, "2026-10-16", noon, K)).toMatchObject({ count: 3, best: 3, today: { me: true, them: false }, atRisk: false });
  });

  it("today done adds to it", () => {
    const d = days({ "2026-10-15": "both", "2026-10-16": "both" });
    expect(friendStreak(d, "2026-10-16", noon, K)).toMatchObject({ count: 2, endsAt: null });
  });

  it("a missed day restarts it; the best is kept, and yesterday's end is noted gently", () => {
    const d = days({ "2026-10-10": "both", "2026-10-11": "both", "2026-10-12": "both", "2026-10-13": "both", "2026-10-14": "me" });
    const s = friendStreak(d, "2026-10-16", noon, K);
    expect(s).toMatchObject({ count: 0, best: 4 });
    const yesterdayBroke = friendStreak(d, "2026-10-15", noon, K);
    expect(yesterdayBroke).toMatchObject({ count: 0, endedAt: 4 });
  });

  it("⌛ under 4 hours left in the viewer's day", () => {
    const d = days({ "2026-10-15": "both" });
    expect(friendStreak(d, "2026-10-16", new Date("2026-10-16T21:00:00+05:00"), K)).toMatchObject({ count: 1, atRisk: true });
    expect(friendStreak(d, "2026-10-16", new Date("2026-10-16T19:00:00+05:00"), K).atRisk).toBe(false);
    // A night owl whose day ends at 2 AM has until then.
    expect(friendStreak(d, "2026-10-16", new Date("2026-10-16T21:00:00+05:00"), { ...K, dayEndHour: 2 }).atRisk).toBe(false);
  });

  it("day end and time left", () => {
    expect(dayEndsAt("2026-10-16", "Asia/Karachi", 0)).toEqual(new Date("2026-10-17T00:00:00+05:00"));
    expect(timeLeft("2026-10-17T00:00:00+05:00", new Date("2026-10-16T21:00:00+05:00"))).toBe("3h left");
    expect(timeLeft("2026-10-17T00:00:00+05:00", new Date("2026-10-16T23:30:00+05:00"))).toBe("30m left");
  });
});
