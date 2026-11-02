import { describe, expect, it } from "vitest";
import { insertOnly } from "./close.js";

describe("closing writes", () => {
  it("insert-only keeps every parameter it uses, and none it doesn't", () => {
    const row = (id: string) => ({
      id, userId: "u", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", deletedAt: null, itemId: "i", date: "2026-10-01",
      slot: "", status: "missed", value: null, detail: { closed: true }, movedTo: null, movedFrom: null, startedAt: null, completedAt: null, deviceId: "server",
    });
    const { text, params } = insertOnly([row("a"), row("b")], "u");
    expect(text).toMatch(/ON CONFLICT DO NOTHING RETURNING "id"$/);
    expect(text).not.toMatch(/DO UPDATE/);
    const used = new Set([...text.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
    expect(Math.max(...used)).toBe(params.length);
    expect(used.size).toBe(params.length);
  });
});
