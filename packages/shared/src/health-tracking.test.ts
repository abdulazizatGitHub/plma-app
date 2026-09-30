import { describe, expect, it } from "vitest";
import {
  counterValue,
  formatClock,
  formatDuration,
  isValidClock,
  lastNDates,
  parseClock,
  parseExercisePayload,
  parseSleepPayload,
  periodDates,
  sleepDurationMinutes,
  sleepWindowFromClock,
  summarizeCounter,
  summarizeExercise,
  summarizeSleep,
  wokeByGoal,
} from "./health-tracking.js";

const DEF = "def-1";
const log = (logDate: string, payload: unknown, habitDefinitionId = DEF) => ({
  habitDefinitionId,
  logDate,
  payload,
});

/** A local wall-clock instant, so tests pass in any timezone. */
const local = (y: number, mo: number, d: number, h: number, mi: number) =>
  new Date(y, mo - 1, d, h, mi).toISOString();

describe("payload parsing", () => {
  it("reads counter values and treats malformed payloads as 0", () => {
    expect(counterValue({ value: 6 })).toBe(6);
    expect(counterValue({ value: -1 })).toBe(0);
    expect(counterValue({ value: 2.5 })).toBe(0);
    expect(counterValue(undefined)).toBe(0);
  });

  it("parses exercise with optional duration/type and rejects unknown types", () => {
    expect(parseExercisePayload({ completed: true })).toEqual({ completed: true });
    expect(parseExercisePayload({ completed: true, durationMinutes: 30, type: "run" })).toEqual({
      completed: true,
      durationMinutes: 30,
      type: "run",
    });
    expect(parseExercisePayload({ completed: true, type: "skydiving" })).toBeNull();
    expect(parseExercisePayload({ completed: true, durationMinutes: 0 })).toBeNull();
    expect(parseExercisePayload(null)).toBeNull();
  });

  it("accepts a valid sleep window and rejects reversed or >24h windows", () => {
    const ok = { bedAt: "2026-09-27T21:00:00.000Z", wakeAt: "2026-09-28T05:00:00.000Z" };
    expect(parseSleepPayload(ok)).toEqual(ok);
    expect(parseSleepPayload({ bedAt: ok.wakeAt, wakeAt: ok.bedAt })).toBeNull();
    expect(
      parseSleepPayload({ bedAt: "2026-09-26T05:00:00.000Z", wakeAt: "2026-09-28T05:00:00.000Z" }),
    ).toBeNull();
    expect(parseSleepPayload({ bedAt: "23:00", wakeAt: "06:00" })).toBeNull();
  });
});

describe("clock and duration helpers", () => {
  it("parses and formats HH:MM", () => {
    expect(parseClock("06:00")).toBe(360);
    expect(parseClock("23:59")).toBe(1439);
    expect(formatClock(390)).toBe("06:30");
    expect(formatClock(1440 + 5)).toBe("00:05");
    expect(() => parseClock("6:00")).toThrow();
    expect(isValidClock("24:00")).toBe(false);
    expect(isValidClock("07:15")).toBe(true);
  });

  it("formats durations compactly", () => {
    expect(formatDuration(440)).toBe("7h 20m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(-5)).toBe("0m");
  });
});

describe("sleep windows", () => {
  it("puts bedtime on the previous day when it's later on the clock than wake time", () => {
    const sleep = sleepWindowFromClock("2026-09-28", "23:10", "06:05");
    expect(sleep.bedAt).toBe(local(2026, 9, 27, 23, 10));
    expect(sleep.wakeAt).toBe(local(2026, 9, 28, 6, 5));
    expect(sleepDurationMinutes(sleep)).toBe(415);
  });

  it("keeps an after-midnight bedtime on the wake date", () => {
    const sleep = sleepWindowFromClock("2026-09-28", "00:30", "07:00");
    expect(sleep.bedAt).toBe(local(2026, 9, 28, 0, 30));
    expect(sleepDurationMinutes(sleep)).toBe(390);
  });

  it("crosses a month boundary", () => {
    const sleep = sleepWindowFromClock("2026-10-01", "22:00", "06:00");
    expect(sleep.bedAt).toBe(local(2026, 9, 30, 22, 0));
  });

  it("checks the wake goal inclusively", () => {
    expect(wokeByGoal(sleepWindowFromClock("2026-09-28", "22:00", "06:00"), "06:00")).toBe(true);
    expect(wokeByGoal(sleepWindowFromClock("2026-09-28", "22:00", "05:45"), "06:00")).toBe(true);
    expect(wokeByGoal(sleepWindowFromClock("2026-09-28", "22:00", "06:01"), "06:00")).toBe(false);
  });
});

describe("periods", () => {
  it("returns Monday-start weeks up to today", () => {
    // 2026-09-30 is a Wednesday.
    expect(periodDates("week", "2026-09-30")).toEqual(["2026-09-28", "2026-09-29", "2026-09-30"]);
    // A Sunday belongs to the week that started the previous Monday.
    expect(periodDates("week", "2026-10-04")[0]).toBe("2026-09-28");
    // A Monday is a one-day week so far.
    expect(periodDates("week", "2026-09-28")).toEqual(["2026-09-28"]);
  });

  it("returns the month from the 1st up to today", () => {
    const dates = periodDates("month", "2026-09-30");
    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe("2026-09-01");
    expect(dates.at(-1)).toBe("2026-09-30");
  });

  it("returns the last N days oldest first", () => {
    expect(lastNDates("2026-10-02", 3)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});

describe("summarizeCounter", () => {
  const dates = ["2026-09-28", "2026-09-29", "2026-09-30"];

  it("averages over every day in the period and counts days at goal", () => {
    const logs = [
      log("2026-09-28", { value: 8 }),
      log("2026-09-29", { value: 4 }),
      log("2026-09-29", { value: 99 }, "other-habit"),
    ];
    expect(summarizeCounter(logs, DEF, dates, 8)).toEqual({
      total: 12,
      average: 4,
      daysAtGoal: 1,
      best: { date: "2026-09-28", value: 8 },
    });
  });

  it("returns an empty summary with no logs", () => {
    expect(summarizeCounter([], DEF, dates, 8)).toEqual({
      total: 0,
      average: 0,
      daysAtGoal: 0,
      best: null,
    });
  });
});

describe("summarizeExercise", () => {
  it("counts completed days, sums minutes, and finds the most frequent type", () => {
    const logs = [
      log("2026-09-28", { completed: true, durationMinutes: 30, type: "run" }),
      log("2026-09-29", { completed: true, type: "gym" }),
      log("2026-09-30", { completed: true, durationMinutes: 45, type: "run" }),
      log("2026-10-01", { completed: false, durationMinutes: 60, type: "gym" }),
    ];
    const dates = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"];
    expect(summarizeExercise(logs, DEF, dates)).toEqual({
      activeDays: 3,
      totalMinutes: 75,
      topType: "run",
    });
  });
});

describe("summarizeSleep", () => {
  it("averages duration and wake time, counts goal nights, and measures spread", () => {
    const logs = [
      log("2026-09-28", sleepWindowFromClock("2026-09-28", "23:00", "06:00")), // 7h, on goal
      log("2026-09-29", sleepWindowFromClock("2026-09-29", "23:00", "07:00")), // 8h, late
      log("2026-09-30", { bedAt: "garbage" }), // ignored
    ];
    const summary = summarizeSleep(logs, DEF, ["2026-09-28", "2026-09-29", "2026-09-30"], "06:00");
    expect(summary).toEqual({
      nights: 2,
      averageMinutes: 450,
      averageWakeMinutes: 390,
      nightsOnGoal: 1,
      wakeSpreadMinutes: 30,
    });
  });

  it("returns nulls when no nights are logged", () => {
    expect(summarizeSleep([], DEF, ["2026-09-28"], "06:00")).toEqual({
      nights: 0,
      averageMinutes: null,
      averageWakeMinutes: null,
      nightsOnGoal: 0,
      wakeSpreadMinutes: null,
    });
  });
});
