import { describe, expect, it } from "vitest";
import { isFriday, isQuranLogDone, quranLogPayloadSchema } from "./quran.js";

describe("isFriday", () => {
  it("returns true for a known Friday", () => {
    // 2026-09-25 is a Friday.
    expect(isFriday("2026-09-25")).toBe(true);
  });

  it("returns false for a known non-Friday", () => {
    // 2026-09-28 is a Monday.
    expect(isFriday("2026-09-28")).toBe(false);
  });

  it("is stable across the whole week", () => {
    const results = [
      ["2026-09-21", false], // Mon
      ["2026-09-22", false], // Tue
      ["2026-09-23", false], // Wed
      ["2026-09-24", false], // Thu
      ["2026-09-25", true], // Fri
      ["2026-09-26", false], // Sat
      ["2026-09-27", false], // Sun
    ] as const;
    for (const [date, expected] of results) {
      expect(isFriday(date)).toBe(expected);
    }
  });

  it("handles a year boundary correctly", () => {
    // 2027-01-01 is a Friday.
    expect(isFriday("2027-01-01")).toBe(true);
  });

  it("throws on malformed date strings", () => {
    expect(() => isFriday("2026/09/25")).toThrow();
    expect(() => isFriday("25-09-2026")).toThrow();
    expect(() => isFriday("not-a-date")).toThrow();
    expect(() => isFriday("")).toThrow();
  });
});

describe("quranLogPayloadSchema", () => {
  it("accepts a valid boolean payload", () => {
    expect(quranLogPayloadSchema.safeParse({ completed: true }).success).toBe(true);
    expect(quranLogPayloadSchema.safeParse({ completed: false }).success).toBe(true);
  });

  it("rejects non-boolean completed values", () => {
    expect(quranLogPayloadSchema.safeParse({ completed: "true" }).success).toBe(false);
    expect(quranLogPayloadSchema.safeParse({ completed: 1 }).success).toBe(false);
    expect(quranLogPayloadSchema.safeParse({}).success).toBe(false);
    expect(quranLogPayloadSchema.safeParse(null).success).toBe(false);
  });
});

describe("isQuranLogDone", () => {
  it("is true only for { completed: true }", () => {
    expect(isQuranLogDone({ completed: true })).toBe(true);
  });

  it("is false for completed:false or malformed payloads", () => {
    expect(isQuranLogDone({ completed: false })).toBe(false);
    expect(isQuranLogDone(undefined)).toBe(false);
    expect(isQuranLogDone({})).toBe(false);
    expect(isQuranLogDone("completed")).toBe(false);
  });
});
