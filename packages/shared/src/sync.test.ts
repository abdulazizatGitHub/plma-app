import { describe, expect, it } from "vitest";
import { syncPullQuerySchema, syncPushBodySchema } from "./sync.js";

const VALID_UUID = "123e4567-e89b-42d3-a456-556642440000";

describe("syncPushBodySchema", () => {
  it("accepts an empty push (no definitions or logs)", () => {
    expect(syncPushBodySchema.safeParse({ deviceId: VALID_UUID }).success).toBe(true);
  });

  it("rejects a missing deviceId", () => {
    expect(syncPushBodySchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-UUID deviceId", () => {
    expect(syncPushBodySchema.safeParse({ deviceId: "not-a-uuid" }).success).toBe(false);
  });

  it("allows habitDefinitions without an id (server assigns one on create)", () => {
    const result = syncPushBodySchema.safeParse({
      deviceId: VALID_UUID,
      habitDefinitions: [
        {
          userId: VALID_UUID,
          slug: "custom-1",
          name: "Custom",
          category: "custom",
          trackingMethod: "boolean",
          frequency: "daily",
          config: {},
          isSystem: false,
          archivedAt: null,
          createdAt: "2026-09-28T00:00:00.000Z",
          updatedAt: "2026-09-28T00:00:00.000Z",
          deletedAt: null,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a habitLog with a malformed logDate inside the push body", () => {
    const result = syncPushBodySchema.safeParse({
      deviceId: VALID_UUID,
      habitLogs: [
        {
          userId: VALID_UUID,
          habitDefinitionId: VALID_UUID,
          logDate: "28-09-2026",
          payload: {},
          deviceId: null,
          createdAt: "2026-09-28T00:00:00.000Z",
          updatedAt: "2026-09-28T00:00:00.000Z",
          deletedAt: null,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("syncPullQuerySchema", () => {
  it("accepts no `since` (full pull)", () => {
    expect(syncPullQuerySchema.safeParse({}).success).toBe(true);
  });

  it("accepts a valid ISO datetime for `since`", () => {
    expect(
      syncPullQuerySchema.safeParse({ since: "2026-09-28T00:00:00.000Z" }).success,
    ).toBe(true);
  });

  it("rejects a non-datetime `since`", () => {
    expect(syncPullQuerySchema.safeParse({ since: "2026-09-28" }).success).toBe(false);
    expect(syncPullQuerySchema.safeParse({ since: "not-a-date" }).success).toBe(false);
  });
});
