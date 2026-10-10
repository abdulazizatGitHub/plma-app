import { STARTER_PACKS } from "@life/shared";
import { describe, expect, it } from "vitest";
import { planPush, type OwnershipLookup } from "../sync/plan.js";
import { packPushBody, packSummaries } from "./packs.js";

const U = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
const nothingStored: OwnershipLookup = { foreignIds: () => Promise.resolve([]), ownedIds: () => Promise.resolve([]) };

describe("starter packs API", () => {
  it("lists every pack with its items", () => {
    const list = packSummaries();
    expect(list.map((p) => p.name)).toEqual(STARTER_PACKS.map((p) => p.name));
    expect(list.find((p) => p.name === "Physical")?.items).toContainEqual({ title: "Gym — Push day", type: "group", subItems: 5 });
  });

  it("builds a push body that passes the normal push planner", async () => {
    const body = packPushBody(STARTER_PACKS[1].id, U, [{ id: "c", sourceTemplateId: null, deletedAt: null, sortOrder: 3 }]);
    expect(body).not.toBeNull();
    const plan = await planPush(U, body, nothingStored);
    expect(plan.ok).toBe(true);
    const category = body!.changes.find((c) => c.entity === "categories")!.row;
    expect(category).toMatchObject({ name: "Physical", sortOrder: 4, sourceTemplateId: STARTER_PACKS[1].id });
  });

  it("returns nothing for a pack the user already adopted", () => {
    const pack = STARTER_PACKS[0];
    expect(packPushBody(pack.id, U, [{ id: "c", sourceTemplateId: pack.id, deletedAt: null, sortOrder: 0 }])).toBeNull();
  });
});
