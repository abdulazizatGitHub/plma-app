import { describe, expect, it } from "vitest";
import { awardDef, challengeText, evaluateAwards, hijriDate, hijriLabel, makeChallenge, type AwardInput, type RewardDay } from "../index.js";
import { fakeDay } from "./test-days.js";

const shift = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const run = (from: string, flags: string, over: Partial<RewardDay> = {}): RewardDay[] => [...flags].map((f, i) => fakeDay(shift(from, i), f, over));
const base: Omit<AwardInput, "days" | "closedThrough" | "today"> = { weekStart: 1, plansFinished: 0, hijriOffset: 0, challenges: [] };
const earned = (input: AwardInput) => evaluateAwards(input).filter((a) => a.earned).map((a) => a.id);

describe("Hijri dates", () => {
  it("Umm al-Qura, with the user's adjustment", () => {
    expect(hijriDate("2027-02-08")).toEqual({ year: 1448, month: 9, day: 1 });
    expect(hijriDate("2027-02-08", -1)).toEqual({ year: 1448, month: 8, day: 30 }); // a day later locally
    expect(hijriLabel(hijriDate("2026-10-15"))).toBe("4 Jumada al-Ula 1448");
  });
});

describe("awards", () => {
  it("streaks, a week of prayers and a perfect week come from closed days", () => {
    const days = run("2026-09-07", "PPPPPPPYY"); // Mon 7 Sep
    expect(earned({ ...base, days, closedThrough: "2026-09-15", today: "2026-09-18" })).toEqual(
      expect.arrayContaining(["streak_3", "streak_7", "prayers_week", "perfect_week"]),
    );
    expect(earned({ ...base, days, closedThrough: "2026-09-09", today: "2026-09-12" })).toEqual(["streak_3"]);
  });

  it("perfect month: a whole closed month, at least 20 days due, every one complete", () => {
    const sept = run("2026-09-01", "Y".repeat(30));
    expect(earned({ ...base, days: sept, closedThrough: "2026-10-03", today: "2026-10-06" })).toContain("perfect_month");
    expect(earned({ ...base, days: sept, closedThrough: "2026-09-29", today: "2026-10-02" })).not.toContain("perfect_month"); // not over
    const oneMiss = run("2026-09-01", "Y".repeat(14) + "N" + "Y".repeat(15));
    expect(earned({ ...base, days: oneMiss, closedThrough: "2026-10-03", today: "2026-10-06" })).not.toContain("perfect_month");
  });

  it("milestones count closed days; progress shows everything so far", () => {
    const days = run("2026-06-01", "Y".repeat(21)); // 105 prayers on time, 168 items
    const a = evaluateAwards({ ...base, days, closedThrough: "2026-06-18", today: "2026-06-21" });
    expect(a.find((x) => x.id === "prayers_100")).toMatchObject({ earned: false, have: 100, need: 100 }); // 90 closed
    const b = evaluateAwards({ ...base, days, closedThrough: "2026-06-21", today: "2026-06-24" });
    expect(b.find((x) => x.id === "prayers_100")?.earned).toBe(true);
    expect(b.find((x) => x.id === "items_100")?.earned).toBe(true);
  });

  it("Jumu'ah: Zuhr prayed four Fridays running", () => {
    const days = run("2026-09-01", "Y".repeat(28)); // Fridays: 4, 11, 18, 25 Sep
    expect(earned({ ...base, days, closedThrough: "2026-09-28", today: "2026-10-01" })).toContain("jumuah_4");
    const missed = days.map((d) => (d.date === "2026-09-11" ? { ...d, dhuhr: false } : d));
    expect(earned({ ...base, days: missed, closedThrough: "2026-09-28", today: "2026-10-01" })).not.toContain("jumuah_4");
  });

  it("Ramadan: Prayer ring every day, judged with the user's Hijri adjustment", () => {
    // Ramadan 1448 (Umm al-Qura): 8 Feb – 8 Mar 2027 (29 days).
    const days = run("2027-01-25", "Y".repeat(50));
    const input = { ...base, days, closedThrough: "2027-03-12", today: "2027-03-15" };
    expect(earned(input)).toContain("ramadan:1448");
    const missOne = days.map((d) => (d.date === "2027-02-08" ? { ...d, prayerClosed: false } : d));
    expect(earned({ ...input, days: missOne })).not.toContain("ramadan:1448");
    // A day later locally, 8 Feb is still Sha'ban, so missing it doesn't matter.
    expect(earned({ ...input, days: missOne, hijriOffset: -1 })).toContain("ramadan:1448");
    // In season: shown with progress.
    const live = evaluateAwards({ ...input, closedThrough: "2027-02-17", today: "2027-02-20" }).find((a) => a.id === "ramadan:1448");
    expect(live).toMatchObject({ earned: false, live: true, have: 13, need: 29 });
    expect(awardDef("ramadan:1448")?.title).toBe("Ramadan 1448");
  });

  it("monthly challenge: the ring with most room to grow, a little above last month", () => {
    const sept = run("2026-09-01", "Y".repeat(30)).map((d, i) => ({ ...d, prayerClosed: i < 15 })); // Prayer 15/30, others 30/30
    const c = makeChallenge("2026-10", sept);
    expect(c).toEqual({ month: "2026-10", ring: "prayer", target: 18 }); // round(15 × 1.1) + 1
    expect(challengeText(c)).toBe("Close your Prayer ring 18 days in October");
    expect(makeChallenge("2026-10", [])).toEqual({ month: "2026-10", ring: "commit", target: 12 });
    const oct = run("2026-10-01", "Y".repeat(20));
    const a = evaluateAwards({ ...base, days: oct, challenges: [c], closedThrough: "2026-10-17", today: "2026-10-20" });
    expect(a.find((x) => x.id === "challenge:2026-10")).toMatchObject({ earned: false, have: 18, need: 18, live: true }); // 17 closed
    const b = evaluateAwards({ ...base, days: oct, challenges: [c], closedThrough: "2026-10-18", today: "2026-10-21" });
    expect(b.find((x) => x.id === "challenge:2026-10")?.earned).toBe(true);
    expect(awardDef("challenge:2026-10")?.title).toBe("October 2026 challenge");
  });
});
