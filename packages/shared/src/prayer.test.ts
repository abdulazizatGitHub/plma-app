import { describe, expect, it } from "vitest";
import {
  PRAYER_NAMES,
  computeMonthlyPrayerReport,
  countPrayersByStatus,
  emptyPrayerPayload,
  isPrayerDayComplete,
  parsePrayerPayload,
  prayerLogPayloadSchema,
} from "./prayer.js";

describe("prayerLogPayloadSchema", () => {
  it("accepts a fully specified payload", () => {
    const result = prayerLogPayloadSchema.safeParse({
      prayers: {
        fajr: "completed",
        zuhr: "completed",
        asr: "missed",
        maghrib: "pending",
        isha: "pending",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing prayer key", () => {
    const result = prayerLogPayloadSchema.safeParse({
      prayers: { fajr: "completed", zuhr: "pending", asr: "pending", maghrib: "pending" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status value", () => {
    const result = prayerLogPayloadSchema.safeParse({
      prayers: {
        fajr: "done", // not a valid enum member
        zuhr: "pending",
        asr: "pending",
        maghrib: "pending",
        isha: "pending",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a completely different shape", () => {
    expect(prayerLogPayloadSchema.safeParse({ completed: true }).success).toBe(false);
    expect(prayerLogPayloadSchema.safeParse(null).success).toBe(false);
    expect(prayerLogPayloadSchema.safeParse(undefined).success).toBe(false);
    expect(prayerLogPayloadSchema.safeParse("prayers").success).toBe(false);
  });
});

describe("parsePrayerPayload", () => {
  it("returns the parsed payload when valid", () => {
    const payload = {
      prayers: {
        fajr: "completed",
        zuhr: "pending",
        asr: "pending",
        maghrib: "pending",
        isha: "pending",
      },
    };
    expect(parsePrayerPayload(payload)).toEqual(payload);
  });

  it("falls back to all-pending for malformed input instead of throwing", () => {
    expect(parsePrayerPayload(undefined)).toEqual(emptyPrayerPayload());
    expect(parsePrayerPayload({})).toEqual(emptyPrayerPayload());
    expect(parsePrayerPayload("garbage")).toEqual(emptyPrayerPayload());
    expect(parsePrayerPayload({ prayers: { fajr: "yes" } })).toEqual(emptyPrayerPayload());
  });
});

describe("countPrayersByStatus", () => {
  it("counts each status bucket correctly", () => {
    const counts = countPrayersByStatus({
      prayers: {
        fajr: "completed",
        zuhr: "completed",
        asr: "missed",
        maghrib: "pending",
        isha: "pending",
      },
    });
    expect(counts).toEqual({ completed: 2, missed: 1, pending: 2 });
  });

  it("treats malformed payload as fully pending", () => {
    expect(countPrayersByStatus(null)).toEqual({ completed: 0, missed: 0, pending: 5 });
  });
});

describe("isPrayerDayComplete", () => {
  it("is true only when all five prayers are completed", () => {
    const all = Object.fromEntries(PRAYER_NAMES.map((n) => [n, "completed"]));
    expect(isPrayerDayComplete({ prayers: all })).toBe(true);
  });

  it("is false when four of five are completed", () => {
    const four = {
      fajr: "completed",
      zuhr: "completed",
      asr: "completed",
      maghrib: "completed",
      isha: "pending",
    };
    expect(isPrayerDayComplete({ prayers: four })).toBe(false);
  });

  it("is false for malformed/empty payload", () => {
    expect(isPrayerDayComplete(undefined)).toBe(false);
  });
});

describe("computeMonthlyPrayerReport", () => {
  it("throws on a malformed month string", () => {
    expect(() => computeMonthlyPrayerReport([], "2026-9")).toThrow();
    expect(() => computeMonthlyPrayerReport([], "September")).toThrow();
  });

  it("produces one row per day of the month with zeroed stats when no logs exist", () => {
    const report = computeMonthlyPrayerReport([], "2026-09");
    expect(report.days).toHaveLength(30); // September has 30 days
    expect(report.days[0]).toEqual({
      date: "2026-09-01",
      completed: 0,
      missed: 0,
      pending: 5,
      total: 5,
      completionPercent: 0,
    });
    expect(report.totalCompleted).toBe(0);
    expect(report.totalPossible).toBe(30 * 5);
    expect(report.completionPercent).toBe(0);
  });

  it("handles February in a leap year (29 days) and a non-leap year (28 days)", () => {
    expect(computeMonthlyPrayerReport([], "2024-02").days).toHaveLength(29);
    expect(computeMonthlyPrayerReport([], "2025-02").days).toHaveLength(28);
  });

  it("ignores logs from other months", () => {
    const report = computeMonthlyPrayerReport(
      [
        {
          logDate: "2026-08-31",
          payload: { prayers: Object.fromEntries(PRAYER_NAMES.map((n) => [n, "completed"])) },
        },
      ],
      "2026-09",
    );
    expect(report.totalCompleted).toBe(0);
  });

  it("aggregates completed prayers across the month and computes percentage", () => {
    const fullDay = { prayers: Object.fromEntries(PRAYER_NAMES.map((n) => [n, "completed"])) };
    const report = computeMonthlyPrayerReport(
      [
        { logDate: "2026-09-01", payload: fullDay },
        { logDate: "2026-09-02", payload: fullDay },
      ],
      "2026-09",
    );
    expect(report.totalCompleted).toBe(10);
    expect(report.days[0].completionPercent).toBe(100);
    expect(report.days[2].completionPercent).toBe(0);
    expect(report.completionPercent).toBe(Math.round((10 / (30 * 5)) * 100));
  });

  it("treats a malformed payload on a given day as all-pending rather than crashing", () => {
    const report = computeMonthlyPrayerReport(
      [{ logDate: "2026-09-05", payload: { garbage: true } }],
      "2026-09",
    );
    const day5 = report.days.find((d) => d.date === "2026-09-05");
    expect(day5?.pending).toBe(5);
    expect(day5?.completed).toBe(0);
  });
});
