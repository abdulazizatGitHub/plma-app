import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "./health.js";

describe("healthResponseSchema", () => {
  it("accepts a well-formed ok response", () => {
    expect(
      healthResponseSchema.safeParse({
        status: "ok",
        service: "life-api",
        timestamp: "2026-09-28T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("rejects any status other than the literal 'ok'", () => {
    expect(
      healthResponseSchema.safeParse({
        status: "error",
        service: "life-api",
        timestamp: "2026-09-28T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("rejects a missing field", () => {
    expect(healthResponseSchema.safeParse({ status: "ok" }).success).toBe(false);
  });
});
