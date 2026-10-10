import { describe, expect, it } from "vitest";
import {
  ENTITY_SPECS,
  SYNC_ENTITIES,
  camelToSnake,
  defaultUserSettings,
  entityColumns,
  itemSchema,
  occurrenceSchema,
  parseSyncRow,
  scheduleSchema,
  snakeToCamel,
  syncPushBodyV2Schema,
  trackingSchema,
} from "./index.js";

const U = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
const ID = "0b7e5c1a-2d3f-4a5b-8c6d-7e8f9a0b1c2d";
const CAT = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const NOW = "2026-10-09T10:00:00.000Z";
const base = { id: ID, userId: U, createdAt: NOW, updatedAt: NOW, deletedAt: null };

const steps = {
  ...base,
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
};

describe("v2 schemas", () => {
  it("accepts a quantity habit like 10,000 steps with a ±500 step", () => {
    expect(itemSchema.safeParse(steps).success).toBe(true);
  });

  it("accepts a prayer-anchored weekly schedule (Kahf: Friday, after Zuhr)", () => {
    const kahf = scheduleSchema.parse({
      v: 1,
      kind: "weekdays",
      weekdays: [5],
      anchor: { type: "prayer", prayer: "dhuhr", relation: "after" },
    });
    expect(kahf.kind === "weekdays" && kahf.anchor?.type === "prayer" && kahf.anchor.offsetMin).toBe(0);
  });

  it("treats a once schedule with a null date as pending", () => {
    expect(scheduleSchema.safeParse({ v: 1, kind: "once", date: null }).success).toBe(true);
  });

  it("rejects bad shapes", () => {
    expect(trackingSchema.safeParse({ v: 1, kind: "quantity", unit: "steps", step: 0 }).success).toBe(false);
    expect(itemSchema.safeParse({ ...steps, title: "   " }).success).toBe(false);
    expect(itemSchema.safeParse({ ...steps, priority: "urgent" }).success).toBe(false);
    expect(occurrenceSchema.safeParse({ ...base, itemId: ID, date: "9/10/2026", slot: "", status: "done", value: null, detail: null, movedTo: null, movedFrom: null, startedAt: null, completedAt: null, deviceId: null }).success).toBe(false);
  });

  it("records qada as a done occurrence with a qada flag", () => {
    const row = { ...base, itemId: ID, date: "2026-10-01", slot: "", status: "done", value: null, detail: { qada: true }, movedTo: null, movedFrom: null, startedAt: null, completedAt: NOW, deviceId: null };
    expect(occurrenceSchema.parse(row).detail).toEqual({ qada: true });
  });

  it("defaults new accounts to Karachi method, Hanafi Asr, friends visibility", () => {
    const s = defaultUserSettings(U, NOW);
    expect([s.calcMethod, s.madhab, s.visibility, s.id]).toEqual(["karachi", "hanafi", "friends", U]);
  });
});

describe("sync registry", () => {
  it("lists parents before the rows that reference them", () => {
    for (const entity of SYNC_ENTITIES) {
      for (const target of Object.values(ENTITY_SPECS[entity].refs)) {
        expect(SYNC_ENTITIES.indexOf(target), `${entity} → ${target}`).toBeLessThanOrEqual(SYNC_ENTITIES.indexOf(entity));
      }
    }
  });

  it("declares only real columns as json/bool/refs", () => {
    for (const entity of SYNC_ENTITIES) {
      const cols = entityColumns(entity);
      const spec = ENTITY_SPECS[entity];
      for (const c of [...spec.json, ...spec.bool, ...Object.keys(spec.refs)]) expect(cols, `${entity}.${c}`).toContain(c);
    }
  });

  it("maps camelCase and snake_case both ways", () => {
    expect(camelToSnake("repeatUntilDone")).toBe("repeat_until_done");
    expect(snakeToCamel("source_template_version")).toBe("sourceTemplateVersion");
  });

  it("validates a push body and its rows", () => {
    const body = syncPushBodyV2Schema.parse({ changes: [{ entity: "items", row: steps }] });
    expect(parseSyncRow("items", body.changes[0].row).success).toBe(true);
    expect(syncPushBodyV2Schema.safeParse({ changes: [{ entity: "points", row: {} }] }).success).toBe(false);
  });
});
