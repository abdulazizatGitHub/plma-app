import { describe, expect, it } from "vitest";
import {
  nextPendingPrayer,
  prayerStreak,
  weeklyPrayerCounts,
  withPrayerStatus,
} from "./prayer-actions";

const DEF = "def-prayer";

function payload(statuses: string[]) {
  const [fajr, zuhr, asr, maghrib, isha] = statuses;
  return { prayers: { fajr, zuhr, asr, maghrib, isha } };
}

const FULL = payload(["completed", "completed", "completed", "completed", "completed"]);

function log(logDate: string, p: unknown, habitDefinitionId = DEF) {
  return { habitDefinitionId, logDate, payload: p };
}

describe("nextPendingPrayer", () => {
  it("returns the first pending prayer in daily order", () => {
    expect(
      nextPendingPrayer(payload(["completed", "missed", "pending", "pending", "pending"])),
    ).toBe("asr");
  });

  it("returns fajr for a missing/malformed payload", () => {
    expect(nextPendingPrayer(undefined)).toBe("fajr");
    expect(nextPendingPrayer({ oops: true })).toBe("fajr");
  });

  it("returns null once all five are logged (completed or missed)", () => {
    expect(
      nextPendingPrayer(payload(["completed", "missed", "completed", "missed", "completed"])),
    ).toBeNull();
  });
});

describe("withPrayerStatus", () => {
  it("replaces only the named prayer and leaves the input untouched", () => {
    const before = payload(["pending", "pending", "pending", "pending", "pending"]);
    const after = withPrayerStatus(before, "zuhr", "completed");
    expect(after.prayers.zuhr).toBe("completed");
    expect(after.prayers.fajr).toBe("pending");
    expect(before.prayers.zuhr).toBe("pending");
  });

  it("starts from all-pending when the payload is malformed", () => {
    expect(withPrayerStatus(null, "isha", "missed").prayers).toEqual({
      fajr: "pending",
      zuhr: "pending",
      asr: "pending",
      maghrib: "pending",
      isha: "missed",
    });
  });
});

describe("weeklyPrayerCounts", () => {
  it("returns completed counts for 7 days oldest-first, ignoring other habits", () => {
    const logs = [
      log("2026-09-28", payload(["completed", "completed", "pending", "pending", "pending"])),
      log("2026-09-26", FULL),
      log("2026-09-28", FULL, "some-other-habit"),
    ];
    const week = weeklyPrayerCounts(logs, DEF, "2026-09-28");
    expect(week).toHaveLength(7);
    expect(week[0].date).toBe("2026-09-22");
    expect(week[6]).toEqual({ date: "2026-09-28", value: 2 });
    expect(week[4]).toEqual({ date: "2026-09-26", value: 5 });
    expect(week[5].value).toBe(0);
  });

  it("crosses month boundaries", () => {
    const week = weeklyPrayerCounts([log("2026-09-30", FULL)], DEF, "2026-10-02");
    expect(week.map((d) => d.date)).toContain("2026-09-30");
    expect(week.find((d) => d.date === "2026-09-30")?.value).toBe(5);
  });
});

describe("prayerStreak", () => {
  it("counts consecutive full days ending today", () => {
    const logs = [log("2026-09-28", FULL), log("2026-09-27", FULL), log("2026-09-26", FULL)];
    expect(prayerStreak(logs, DEF, "2026-09-28")).toBe(3);
  });

  it("doesn't reset when today is still in progress", () => {
    const logs = [
      log("2026-09-28", payload(["completed", "pending", "pending", "pending", "pending"])),
      log("2026-09-27", FULL),
      log("2026-09-26", FULL),
    ];
    expect(prayerStreak(logs, DEF, "2026-09-28")).toBe(2);
  });

  it("breaks on a gap day", () => {
    const logs = [log("2026-09-28", FULL), log("2026-09-26", FULL)];
    expect(prayerStreak(logs, DEF, "2026-09-28")).toBe(1);
  });

  it("is zero with no logs", () => {
    expect(prayerStreak([], DEF, "2026-09-28")).toBe(0);
  });
});
