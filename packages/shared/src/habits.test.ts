import { describe, expect, it } from "vitest";
import {
  createHabitDefinitionSchema,
  habitDefinitionSchema,
  habitLogSchema,
  upsertHabitLogSchema,
} from "./habits.js";

const VALID_UUID = "123e4567-e89b-42d3-a456-556642440000";

describe("habitDefinitionSchema", () => {
  const base = {
    id: VALID_UUID,
    userId: VALID_UUID,
    slug: "prayer",
    name: "Daily prayers",
    category: "faith",
    trackingMethod: "prayer_set",
    frequency: "daily",
    config: {},
    isSystem: true,
    archivedAt: null,
    createdAt: "2026-09-28T00:00:00.000Z",
    updatedAt: "2026-09-28T00:00:00.000Z",
    deletedAt: null,
  };

  it("accepts a well-formed definition", () => {
    expect(habitDefinitionSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a non-UUID id", () => {
    expect(habitDefinitionSchema.safeParse({ ...base, id: "not-a-uuid" }).success).toBe(false);
  });

  it("rejects a missing required field", () => {
    const { name: _name, ...withoutName } = base;
    expect(habitDefinitionSchema.safeParse(withoutName).success).toBe(false);
  });

  it("accepts arbitrary config keys (extensible habit config, CRD §24)", () => {
    const result = habitDefinitionSchema.safeParse({
      ...base,
      config: { goal: 10000, unit: "steps", anything: [1, 2, 3] },
    });
    expect(result.success).toBe(true);
  });
});

describe("createHabitDefinitionSchema", () => {
  it("accepts a minimal valid name and applies defaults", () => {
    const result = createHabitDefinitionSchema.safeParse({ name: "Skincare" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe("custom");
      expect(result.data.trackingMethod).toBe("boolean");
      expect(result.data.frequency).toBe("daily");
    }
  });

  it("rejects an empty name", () => {
    expect(createHabitDefinitionSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects a name over 120 characters", () => {
    expect(
      createHabitDefinitionSchema.safeParse({ name: "a".repeat(121) }).success,
    ).toBe(false);
  });

  it("accepts a name at exactly the 120-character boundary", () => {
    expect(
      createHabitDefinitionSchema.safeParse({ name: "a".repeat(120) }).success,
    ).toBe(true);
  });

  it("rejects an unknown trackingMethod", () => {
    expect(
      createHabitDefinitionSchema.safeParse({ name: "X", trackingMethod: "vibes" }).success,
    ).toBe(false);
  });

  it("rejects an unknown frequency", () => {
    expect(
      createHabitDefinitionSchema.safeParse({ name: "X", frequency: "hourly" }).success,
    ).toBe(false);
  });

  it("rejects a missing name", () => {
    expect(createHabitDefinitionSchema.safeParse({}).success).toBe(false);
  });
});

describe("habitLogSchema / upsertHabitLogSchema", () => {
  const base = {
    id: VALID_UUID,
    userId: VALID_UUID,
    habitDefinitionId: VALID_UUID,
    logDate: "2026-09-28",
    payload: { completed: true },
    deviceId: null,
    createdAt: "2026-09-28T00:00:00.000Z",
    updatedAt: "2026-09-28T00:00:00.000Z",
    deletedAt: null,
  };

  it("accepts a well-formed log", () => {
    expect(habitLogSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a malformed logDate", () => {
    for (const bad of ["2026/09/28", "28-09-2026", "2026-9-28", "not-a-date", ""]) {
      expect(habitLogSchema.safeParse({ ...base, logDate: bad }).success).toBe(false);
    }
  });

  it("upsertHabitLogSchema requires habitDefinitionId, logDate, payload and treats deviceId as optional", () => {
    const result = upsertHabitLogSchema.safeParse({
      habitDefinitionId: VALID_UUID,
      logDate: "2026-09-28",
      payload: { completed: true },
    });
    expect(result.success).toBe(true);
  });

  it("upsertHabitLogSchema rejects a non-UUID habitDefinitionId", () => {
    expect(
      upsertHabitLogSchema.safeParse({
        habitDefinitionId: "abc",
        logDate: "2026-09-28",
        payload: {},
      }).success,
    ).toBe(false);
  });
});
