import "fake-indexeddb/auto";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { LocalStore, wipeUserStore, type StoredRow } from "./local-store";
import { syncOnce } from "./sync";

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs();
});

const A = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
const B = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function category(userId: string, name: string, updatedAt = "2026-10-09T10:00:00.000Z"): StoredRow {
  return { id: uuid(), userId, createdAt: updatedAt, updatedAt, deletedAt: null, name, icon: "tag", color: "mint", sortOrder: 0, archivedAt: null, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null };
}

describe("LocalStore", () => {
  it("keeps two accounts on one device completely separate", async () => {
    const a = await LocalStore.open(A, { sqlJs: SQL });
    a.save("categories", category(A, "Spiritual"));
    await a.flush();
    const b = await LocalStore.open(B, { sqlJs: SQL });
    expect(b.query("categories")).toHaveLength(0);
    const reopened = await LocalStore.open(A, { sqlJs: SQL });
    expect(reopened.query("categories").map((c) => c.name)).toEqual(["Spiritual"]);
  });

  it("round-trips JSON and boolean columns", async () => {
    const s = await LocalStore.open(uuid(), { sqlJs: SQL });
    const row = { ...category(A, "x"), id: uuid() };
    const item: StoredRow = { ...row, categoryId: null, parentId: null, type: "habit", title: "Steps", notes: null, priority: "medium", isOptional: true, tracking: { v: 1, kind: "quantity", unit: "steps", target: 10000, step: 500 }, schedule: { v: 1, kind: "daily" }, meta: { a: [1, 2] }, groupGoalId: null };
    s.save("items", item);
    const back = s.get("items", item.id)!;
    expect(back.isOptional).toBe(true);
    expect(back.tracking).toEqual(item.tracking);
    expect(back.meta).toEqual({ a: [1, 2] });
  });

  it("stores more than 5 MB (IndexedDB, not localStorage)", async () => {
    const user = uuid();
    const s = await LocalStore.open(user, { sqlJs: SQL });
    const big = "x".repeat(60_000);
    for (let i = 0; i < 100; i++) s.save("categories", { ...category(user, "c"), icon: big });
    await s.flush();
    const back = await LocalStore.open(user, { sqlJs: SQL });
    expect(back.query("categories")).toHaveLength(100);
  });

  it("applies server rows last-write-wins and never over an unsent local edit", async () => {
    const s = await LocalStore.open(uuid(), { sqlJs: SQL });
    const local = category(A, "Local", "2026-10-09T12:00:00.000Z");
    s.save("categories", local);
    expect(s.applyRemote("categories", { ...local, name: "Server", updatedAt: "2026-10-09T13:00:00.000Z" })).toBe(false); // pending edit wins
    s.ack(s.outbox().map((e) => e.seq));
    expect(s.applyRemote("categories", { ...local, name: "Older", updatedAt: "2026-10-09T11:00:00.000Z" })).toBe(false);
    expect(s.applyRemote("categories", { ...local, name: "Newer", updatedAt: "2026-10-09T13:00:00.000Z" })).toBe(true);
    expect(s.get("categories", local.id)?.name).toBe("Newer");
  });

  it("wipes a user's data on sign-out", async () => {
    const user = uuid();
    const s = await LocalStore.open(user, { sqlJs: SQL });
    s.save("categories", category(user, "Gone"));
    await s.flush();
    await wipeUserStore(user);
    expect((await LocalStore.open(user, { sqlJs: SQL })).query("categories")).toHaveLength(0);
  });

  it("an open store cannot write itself back after a sign-out wipe", async () => {
    const user = uuid();
    const s = await LocalStore.open(user, { sqlJs: SQL });
    s.save("categories", category(user, "Pending write"));
    await wipeUserStore(user); // sign-out while the store is still open
    await s.flush(); // what the provider's cleanup does next
    await new Promise((r) => setTimeout(r, 300)); // and any debounced persist
    expect((await LocalStore.open(user, { sqlJs: SQL })).query("categories")).toHaveLength(0);
  });
});

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("syncOnce", () => {
  const deps = (fetchImpl: typeof fetch, token: string | null = "t") => ({ apiBase: "http://api", getToken: async () => token, fetchImpl });

  it("pushes the outbox, pulls remote rows and stores the cursor", async () => {
    const user = uuid();
    const s = await LocalStore.open(user, { sqlJs: SQL });
    s.save("categories", category(user, "Mine"));
    const remote = category(user, "From phone");
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("/push")
        ? respond(200, { serverTime: "x", accepted: 1, stale: 0 })
        : respond(200, { serverTime: "2026-10-09T14:00:00.000Z", changes: { categories: [remote] } }),
    ) as unknown as typeof fetch;
    const result = await syncOnce(s, deps(fetchImpl));
    expect(result).toEqual({ ok: true, pushed: 1, pulled: 1, rejected: 0 });
    expect(s.pendingCount()).toBe(0);
    expect(s.getMeta("pull_cursor")).toBe("2026-10-09T14:00:00.000Z");
    expect(s.query("categories").map((c) => c.name).sort()).toEqual(["From phone", "Mine"]);
  });

  it("keeps the outbox when offline", async () => {
    const s = await LocalStore.open(uuid(), { sqlJs: SQL });
    s.save("categories", category(A, "Queued"));
    const result = await syncOnce(s, deps((async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch));
    expect(result).toMatchObject({ ok: false, reason: "offline" });
    expect(s.pendingCount()).toBe(1);
  });

  it("treats a busy server (503 / 429) like being offline: changes stay queued", async () => {
    for (const status of [503, 429]) {
      const s = await LocalStore.open(uuid(), { sqlJs: SQL });
      s.save("categories", category(A, "Queued"));
      const result = await syncOnce(s, deps((async () => respond(status, { error: { code: "db_unavailable" } })) as unknown as typeof fetch));
      expect(result).toMatchObject({ ok: false, reason: "offline" });
      expect(s.pendingCount()).toBe(1);
    }
  });

  it("does nothing when signed out", async () => {
    const s = await LocalStore.open(uuid(), { sqlJs: SQL });
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    expect(await syncOnce(s, deps(fetchImpl, null))).toMatchObject({ ok: false, reason: "signed_out" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sets aside only the row the server refuses; the rest still sync", async () => {
    const s = await LocalStore.open(uuid(), { sqlJs: SQL });
    const good = category(A, "Good");
    const bad = category(A, "Bad");
    s.save("categories", good);
    s.save("categories", bad);
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("/pull")) return respond(200, { serverTime: "t", changes: {} });
      const body = JSON.parse(String(init?.body)) as { changes: { row: StoredRow }[] };
      return body.changes.some((c) => c.row.name === "Bad") ? respond(422, { error: { message: "nope" } }) : respond(200, {});
    }) as unknown as typeof fetch;
    expect(await syncOnce(s, deps(fetchImpl))).toEqual({ ok: true, pushed: 1, pulled: 0, rejected: 1 });
    expect(s.pendingCount()).toBe(0);
  });
});

describe("server refusals (Phase 7)", () => {
  const deps = (fetchImpl: typeof fetch) => ({ apiBase: "http://api", getToken: async () => "t", fetchImpl });
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const occ = (status: string, updatedAt: string): StoredRow => ({
    id: "00000000-0000-4000-8000-0000000000aa", userId: A, createdAt: updatedAt, updatedAt, deletedAt: null, itemId: "00000000-0000-4000-8000-0000000000bb",
    date: "2026-10-01", slot: "", status, value: null, detail: null, movedTo: null, movedFrom: null, startedAt: null, completedAt: null, deviceId: null,
  });

  it("a change to a closed day is put back to the server's copy, with a notice", async () => {
    const s = await LocalStore.open(uuid(), { sqlJs: SQL });
    const serverCopy = occ("missed", "2026-10-01T00:00:00.000Z");
    s.save("occurrences", occ("done", "2026-10-12T10:00:00.000Z"));
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("/push")
        ? json(422, { error: { code: "day_closed", message: "That day is closed — your change wasn't saved.", refused: [{ id: serverCopy.id, code: "day_closed", message: "That day is closed — your change wasn't saved.", current: serverCopy }] } })
        : json(200, { serverTime: "2026-10-12T10:00:01.000Z", changes: {}, closedThrough: "2026-10-09" }),
    ) as unknown as typeof fetch;
    const result = await syncOnce(s, deps(fetchImpl));
    expect(result).toMatchObject({ ok: true, rejected: 1, notice: "That day is closed — your change wasn't saved." });
    expect(s.get("occurrences", serverCopy.id)).toMatchObject({ status: "missed" });
    expect(s.getMeta("closed_through")).toBe("2026-10-09");
  });

  it("a refused row the server never had is removed locally", async () => {
    const s = await LocalStore.open(uuid(), { sqlJs: SQL });
    const mine = occ("done", "2026-10-12T10:00:00.000Z");
    s.save("occurrences", mine);
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("/push")
        ? json(422, { error: { code: "day_closed", message: "closed", refused: [{ id: mine.id, code: "day_closed", message: "closed", current: null }] } })
        : json(200, { serverTime: "2026-10-12T10:00:01.000Z", changes: {} }),
    ) as unknown as typeof fetch;
    await syncOnce(s, deps(fetchImpl));
    expect(s.get("occurrences", mine.id)).toBeNull();
  });
});
