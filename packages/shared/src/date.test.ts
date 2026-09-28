import { describe, expect, it } from "vitest";
import { isValidLocalDateString, toLocalDateString, todayLocalDate } from "./date.js";

describe("toLocalDateString", () => {
  it("formats year, month, day with zero-padding", () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toLocalDateString(new Date(2026, 8, 28))).toBe("2026-09-28");
  });

  it("pads single-digit months and days", () => {
    expect(toLocalDateString(new Date(2001, 1, 1))).toBe("2001-02-01");
  });
});

describe("todayLocalDate", () => {
  it("matches the current local date", () => {
    const now = new Date();
    expect(todayLocalDate()).toBe(toLocalDateString(now));
  });
});

describe("isValidLocalDateString", () => {
  it("accepts a real calendar date", () => {
    expect(isValidLocalDateString("2026-09-28")).toBe(true);
  });

  it("rejects malformed formats", () => {
    expect(isValidLocalDateString("2026/09/28")).toBe(false);
    expect(isValidLocalDateString("28-09-2026")).toBe(false);
    expect(isValidLocalDateString("2026-9-28")).toBe(false);
    expect(isValidLocalDateString("")).toBe(false);
  });

  it("rejects calendar-invalid dates that Date() silently rolls over", () => {
    expect(isValidLocalDateString("2026-02-30")).toBe(false); // Feb never has 30 days
    expect(isValidLocalDateString("2026-13-01")).toBe(false); // month 13
    expect(isValidLocalDateString("2026-00-10")).toBe(false); // month 0
  });

  it("handles leap years correctly", () => {
    expect(isValidLocalDateString("2024-02-29")).toBe(true); // leap year
    expect(isValidLocalDateString("2025-02-29")).toBe(false); // not a leap year
  });
});
