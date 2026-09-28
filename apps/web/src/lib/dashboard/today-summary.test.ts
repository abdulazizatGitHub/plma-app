import type { HabitDefinitionDto, HabitLogDto } from "@life/shared";
import { describe, expect, it } from "vitest";
import { buildTodayDashboard } from "./today-summary";

const USER_ID = "123e4567-e89b-42d3-a456-556642440000";

function makeDef(
  overrides: Partial<HabitDefinitionDto> & { id: string; slug: string },
): HabitDefinitionDto {
  return {
    userId: USER_ID,
    name: overrides.slug,
    category: "faith",
    trackingMethod: "boolean",
    frequency: "daily",
    config: {},
    isSystem: true,
    archivedAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

function makeLog(
  overrides: Partial<HabitLogDto> & {
    id: string;
    habitDefinitionId: string;
    logDate: string;
    payload: Record<string, unknown>;
  },
): HabitLogDto {
  return {
    userId: USER_ID,
    deviceId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

const PRAYER_DEF = makeDef({ id: "def-prayer", slug: "prayer" });
const MULK_DEF = makeDef({ id: "def-mulk", slug: "quran-mulk", frequency: "nightly" });
const KAHF_DEF = makeDef({ id: "def-kahf", slug: "quran-kahf", frequency: "weekly_friday" });
const STEPS_DEF = makeDef({
  id: "def-steps",
  slug: "steps",
  trackingMethod: "counter",
  config: { goal: 10000, unit: "steps" },
});
const WATER_DEF = makeDef({
  id: "def-water",
  slug: "water",
  trackingMethod: "counter",
  config: { goal: 8, unit: "glasses" },
});
const EXERCISE_DEF = makeDef({ id: "def-exercise", slug: "exercise" });
const MAKE_BED_DEF = makeDef({ id: "def-make-bed", slug: "make-bed" });
const NO_PHONE_DEF = makeDef({ id: "def-no-phone", slug: "no-phone-hour" });

const ALL_DEFS = [
  PRAYER_DEF,
  MULK_DEF,
  KAHF_DEF,
  STEPS_DEF,
  WATER_DEF,
  EXERCISE_DEF,
  MAKE_BED_DEF,
  NO_PHONE_DEF,
];

const MONDAY = "2026-09-28";
const FRIDAY = "2026-09-25";

describe("buildTodayDashboard — empty state", () => {
  it("shows dashes/zeros for every row when no definitions exist yet", () => {
    const { rows, completionPercent } = buildTodayDashboard([], [], MONDAY);
    expect(completionPercent).toBe(0);
    const prayerRow = rows.find((r) => r.key === "prayer");
    expect(prayerRow).toEqual({ key: "prayer", label: "Prayer", value: "—", done: false });
  });

  it("returns 0% completion when there are definitions but zero logs", () => {
    const { completionPercent } = buildTodayDashboard(ALL_DEFS, [], MONDAY);
    expect(completionPercent).toBe(0);
  });
});

describe("buildTodayDashboard — prayer", () => {
  it("counts partial prayer completion", () => {
    const log = makeLog({
      id: "log-1",
      habitDefinitionId: PRAYER_DEF.id,
      logDate: MONDAY,
      payload: {
        prayers: {
          fajr: "completed",
          zuhr: "completed",
          asr: "missed",
          maghrib: "pending",
          isha: "pending",
        },
      },
    });
    const { rows } = buildTodayDashboard(ALL_DEFS, [log], MONDAY);
    const row = rows.find((r) => r.key === "prayer");
    expect(row).toMatchObject({ value: "2/5", done: false });
  });

  it("marks the day done at exactly 5/5, not before", () => {
    const four = makeLog({
      id: "log-2",
      habitDefinitionId: PRAYER_DEF.id,
      logDate: MONDAY,
      payload: {
        prayers: {
          fajr: "completed",
          zuhr: "completed",
          asr: "completed",
          maghrib: "completed",
          isha: "pending",
        },
      },
    });
    expect(
      buildTodayDashboard(ALL_DEFS, [four], MONDAY).rows.find((r) => r.key === "prayer")?.done,
    ).toBe(false);

    const five = makeLog({
      ...four,
      payload: {
        prayers: {
          fajr: "completed",
          zuhr: "completed",
          asr: "completed",
          maghrib: "completed",
          isha: "completed",
        },
      },
    });
    expect(
      buildTodayDashboard(ALL_DEFS, [five], MONDAY).rows.find((r) => r.key === "prayer")?.done,
    ).toBe(true);
  });

  it("ignores logs from a different day", () => {
    const yesterdayLog = makeLog({
      id: "log-3",
      habitDefinitionId: PRAYER_DEF.id,
      logDate: "2026-09-27",
      payload: {
        prayers: {
          fajr: "completed",
          zuhr: "completed",
          asr: "completed",
          maghrib: "completed",
          isha: "completed",
        },
      },
    });
    const row = buildTodayDashboard(ALL_DEFS, [yesterdayLog], MONDAY).rows.find(
      (r) => r.key === "prayer",
    );
    expect(row?.value).toBe("0/5");
  });

  it("treats a malformed prayer payload as all-pending rather than crashing", () => {
    const badLog = makeLog({
      id: "log-4",
      habitDefinitionId: PRAYER_DEF.id,
      logDate: MONDAY,
      payload: { oops: true },
    });
    expect(() => buildTodayDashboard(ALL_DEFS, [badLog], MONDAY)).not.toThrow();
    const row = buildTodayDashboard(ALL_DEFS, [badLog], MONDAY).rows.find(
      (r) => r.key === "prayer",
    );
    expect(row?.value).toBe("0/5");
  });
});

describe("buildTodayDashboard — quran (Mulk nightly, Kahf Fridays only)", () => {
  it("on a non-Friday, only Mulk counts and Kahf is excluded from the denominator", () => {
    const mulkDone = makeLog({
      id: "log-5",
      habitDefinitionId: MULK_DEF.id,
      logDate: MONDAY,
      payload: { completed: true },
    });
    const row = buildTodayDashboard(ALL_DEFS, [mulkDone], MONDAY).rows.find(
      (r) => r.key === "quran",
    );
    expect(row).toMatchObject({ value: "1/1", done: true });
  });

  it("on a Friday, both Mulk and Kahf count toward the total", () => {
    const mulkDone = makeLog({
      id: "log-6",
      habitDefinitionId: MULK_DEF.id,
      logDate: FRIDAY,
      payload: { completed: true },
    });
    const row = buildTodayDashboard(ALL_DEFS, [mulkDone], FRIDAY).rows.find(
      (r) => r.key === "quran",
    );
    expect(row).toMatchObject({ value: "1/2", done: false });
  });

  it("is fully done on a Friday only when both Mulk and Kahf are completed", () => {
    const both = [
      makeLog({
        id: "log-7",
        habitDefinitionId: MULK_DEF.id,
        logDate: FRIDAY,
        payload: { completed: true },
      }),
      makeLog({
        id: "log-8",
        habitDefinitionId: KAHF_DEF.id,
        logDate: FRIDAY,
        payload: { completed: true },
      }),
    ];
    const row = buildTodayDashboard(ALL_DEFS, both, FRIDAY).rows.find((r) => r.key === "quran");
    expect(row).toMatchObject({ value: "2/2", done: true });
  });

  it("shows N/A when neither Mulk nor Kahf habit is configured", () => {
    const row = buildTodayDashboard([], [], MONDAY).rows.find((r) => r.key === "quran");
    expect(row?.value).toBe("N/A");
  });
});

describe("buildTodayDashboard — counters (steps/water)", () => {
  it("is not done below goal and done at/above goal", () => {
    const below = makeLog({
      id: "log-9",
      habitDefinitionId: STEPS_DEF.id,
      logDate: MONDAY,
      payload: { value: 9999 },
    });
    expect(
      buildTodayDashboard(ALL_DEFS, [below], MONDAY).rows.find((r) => r.key === "steps")?.done,
    ).toBe(false);

    const atGoal = makeLog({ ...below, payload: { value: 10000 } });
    expect(
      buildTodayDashboard(ALL_DEFS, [atGoal], MONDAY).rows.find((r) => r.key === "steps")?.done,
    ).toBe(true);

    const aboveGoal = makeLog({ ...below, payload: { value: 12000 } });
    expect(
      buildTodayDashboard(ALL_DEFS, [aboveGoal], MONDAY).rows.find((r) => r.key === "steps")
        ?.done,
    ).toBe(true);
  });

  it("uses a per-habit custom goal from config over the fallback", () => {
    const customGoalDef = makeDef({
      id: "def-water-2",
      slug: "water",
      trackingMethod: "counter",
      config: { goal: 12 },
    });
    const log = makeLog({
      id: "log-10",
      habitDefinitionId: "def-water-2",
      logDate: MONDAY,
      payload: { value: 10 },
    });
    const row = buildTodayDashboard([customGoalDef], [log], MONDAY).rows.find(
      (r) => r.key === "water",
    );
    expect(row).toMatchObject({ value: "10/12", done: false });
  });

  it("treats a missing counter value as zero", () => {
    const log = makeLog({
      id: "log-11",
      habitDefinitionId: WATER_DEF.id,
      logDate: MONDAY,
      payload: {},
    });
    const row = buildTodayDashboard(ALL_DEFS, [log], MONDAY).rows.find((r) => r.key === "water");
    expect(row).toMatchObject({ value: "0/8", done: false });
  });
});

describe("buildTodayDashboard — completion percentage", () => {
  it("excludes not-yet-implemented rows (reading/study) from the percentage", () => {
    const allDone = [
      makeLog({
        id: "log-12",
        habitDefinitionId: PRAYER_DEF.id,
        logDate: MONDAY,
        payload: {
          prayers: {
            fajr: "completed",
            zuhr: "completed",
            asr: "completed",
            maghrib: "completed",
            isha: "completed",
          },
        },
      }),
      makeLog({
        id: "log-13",
        habitDefinitionId: MULK_DEF.id,
        logDate: MONDAY,
        payload: { completed: true },
      }),
      makeLog({
        id: "log-14",
        habitDefinitionId: STEPS_DEF.id,
        logDate: MONDAY,
        payload: { value: 10000 },
      }),
      makeLog({
        id: "log-15",
        habitDefinitionId: WATER_DEF.id,
        logDate: MONDAY,
        payload: { value: 8 },
      }),
      makeLog({
        id: "log-16",
        habitDefinitionId: EXERCISE_DEF.id,
        logDate: MONDAY,
        payload: { completed: true },
      }),
      makeLog({
        id: "log-17",
        habitDefinitionId: MAKE_BED_DEF.id,
        logDate: MONDAY,
        payload: { completed: true },
      }),
      makeLog({
        id: "log-18",
        habitDefinitionId: NO_PHONE_DEF.id,
        logDate: MONDAY,
        payload: { completed: true },
      }),
    ];
    const { completionPercent, rows } = buildTodayDashboard(ALL_DEFS, allDone, MONDAY);
    expect(completionPercent).toBe(100);
    // Reading/study are still shown but don't block 100% completion.
    expect(rows.find((r) => r.key === "reading")?.done).toBe(false);
    expect(rows.find((r) => r.key === "study")?.done).toBe(false);
  });

  it("defaults the `date` argument to today when omitted", () => {
    expect(() => buildTodayDashboard([], [])).not.toThrow();
  });
});
