import type { SyncEntity } from "@life/shared";
import { describe, expect, it } from "vitest";
import { planPush, type OwnershipLookup } from "./plan.js";
import { buildPull, buildUpsert, toDto } from "./sql.js";

const ME = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
const OTHER = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const CAT = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const ITEM = "0b7e5c1a-2d3f-4a5b-8c6d-7e8f9a0b1c2d";
const THEIR_ITEM = "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a";
const OCC = "3e4f5a6b-7c8d-4e9f-8a1b-2c3d4e5f6a7b";
const NOW = "2026-10-09T10:00:00.000Z";

const base = (id: string, userId = ME) => ({ id, userId, createdAt: NOW, updatedAt: NOW, deletedAt: null });
const category = (userId = ME) => ({ ...base(CAT, userId), name: "Physical", icon: "dumbbell", color: "mint", sortOrder: 0, archivedAt: null, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null });
const item = (over: Record<string, unknown> = {}) => ({
  ...base(ITEM),
  categoryId: CAT,
  parentId: null,
  type: "habit",
  title: "Steps",
  notes: null,
  priority: "medium",
  isOptional: false,
  tracking: { v: 1, kind: "quantity", unit: "steps", target: 10000, step: 500 },
  schedule: { v: 1, kind: "daily" },
  meta: {},
  groupGoalId: null,
  sortOrder: 0,
  archivedAt: null,
  sourceTemplateId: null,
  sourceTemplateVersion: null,
  adoptedAt: null,
  ...over,
});
const occurrence = (itemId: string) => ({ ...base(OCC), itemId, date: "2026-10-09", slot: "", status: "done", value: 10000, detail: null, movedTo: null, movedFrom: null, startedAt: null, completedAt: NOW, deviceId: null });

/** In-memory owners table: entity → id → userId. */
function lookupFrom(owners: Partial<Record<SyncEntity, Record<string, string>>>): OwnershipLookup {
  return {
    foreignIds(entity, ids, userId) {
      return Promise.resolve(ids.filter((id) => owners[entity]?.[id] !== undefined && owners[entity]?.[id] !== userId));
    },
    ownedIds(entity, ids, userId) {
      return Promise.resolve(ids.filter((id) => owners[entity]?.[id] === userId));
    },
  };
}

describe("planPush", () => {
  it("accepts a category, its item and an occurrence in one batch, in dependency order", async () => {
    const plan = await planPush(ME, { changes: [
      { entity: "occurrences", row: occurrence(ITEM) },
      { entity: "items", row: item() },
      { entity: "categories", row: category() },
    ] }, lookupFrom({}));
    expect(plan.ok).toBe(true);
    if (plan.ok) expect([...plan.rows.keys()]).toEqual(["categories", "items", "occurrences"]);
  });

  it("accepts references to rows the caller already stored", async () => {
    const plan = await planPush(ME, { changes: [{ entity: "occurrences", row: occurrence(ITEM) }] }, lookupFrom({ items: { [ITEM]: ME } }));
    expect(plan.ok).toBe(true);
  });

  it("BUG-002: rejects an occurrence pointing at another user's item", async () => {
    const plan = await planPush(ME, { changes: [{ entity: "occurrences", row: occurrence(THEIR_ITEM) }] }, lookupFrom({ items: { [THEIR_ITEM]: OTHER } }));
    expect(plan).toMatchObject({ ok: false, status: 422, code: "unknown_reference" });
  });

  it("rejects rows claiming another user id", async () => {
    const plan = await planPush(ME, { changes: [{ entity: "categories", row: category(OTHER) }] }, lookupFrom({}));
    expect(plan).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects re-using an id that another account owns (no cross-user overwrite)", async () => {
    const plan = await planPush(ME, { changes: [{ entity: "categories", row: category() }] }, lookupFrom({ categories: { [CAT]: OTHER } }));
    expect(plan).toMatchObject({ ok: false, status: 409, code: "id_conflict" });
  });

  it("rejects a parent item that does not exist", async () => {
    const plan = await planPush(ME, { changes: [{ entity: "items", row: item({ categoryId: null, parentId: THEIR_ITEM }) }] }, lookupFrom({}));
    expect(plan).toMatchObject({ ok: false, code: "unknown_reference" });
  });

  it("rejects invalid rows and server-only entities", async () => {
    expect(await planPush(ME, { changes: [{ entity: "items", row: item({ title: "" }) }] }, lookupFrom({}))).toMatchObject({ ok: false, status: 400 });
    expect(await planPush(ME, { changes: [{ entity: "points", row: {} }] }, lookupFrom({}))).toMatchObject({ ok: false, status: 400 });
  });

  it("requires user settings to be keyed by the user id", async () => {
    const settings = { ...base(CAT), timezone: "Asia/Karachi", weekStart: 1, lat: null, lng: null, locationLabel: null, calcMethod: "karachi", madhab: "hanafi", prayerOffsets: {}, dayParts: [], quietFrom: null, quietTo: null, visibility: "friends" };
    expect(await planPush(ME, { changes: [{ entity: "userSettings", row: settings }] }, lookupFrom({}))).toMatchObject({ ok: false, status: 403 });
    expect((await planPush(ME, { changes: [{ entity: "userSettings", row: { ...settings, id: ME } }] }, lookupFrom({}))).ok).toBe(true);
  });
});

describe("sync SQL", () => {
  it("builds a parameterised, owner-guarded last-write-wins upsert", () => {
    const { text, params } = buildUpsert("items", [item()], ME);
    expect(text).toContain('INSERT INTO "items"');
    expect(text).toContain('ON CONFLICT ("id") DO UPDATE SET');
    expect(text).toContain('WHERE "items"."user_id" = $');
    expect(text).toContain('"items"."updated_at" <= EXCLUDED."updated_at"');
    expect(text).not.toContain('"user_id" = EXCLUDED');
    expect(text).not.toContain("Steps"); // values are bound, never inlined
    expect(params).toContain("Steps");
    expect(params).toContain(JSON.stringify({ v: 1, kind: "daily" }));
    expect(params.at(-1)).toBe(ME);
  });

  it("pulls changes since a cursor with overlap, or all live rows", () => {
    expect(buildPull("occurrences", ME, NOW).text).toContain("interval '10 seconds'");
    expect(buildPull("occurrences", ME).text).toContain('"deleted_at" IS NULL');
  });

  it("maps Postgres JSON rows to DTOs", () => {
    expect(toDto({ id: ITEM, user_id: ME, is_optional: false, updated_at: "2026-10-09T15:00:00+05:00", date: "2026-10-09", synced_at: NOW })).toEqual({
      id: ITEM,
      userId: ME,
      isOptional: false,
      updatedAt: "2026-10-09T10:00:00.000Z",
      date: "2026-10-09",
    });
  });
});
