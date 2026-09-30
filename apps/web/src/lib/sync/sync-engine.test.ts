import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A minimal fake standing in for the sql.js Database + our local-db helpers.
// It only implements the handful of query shapes sync-engine.ts actually
// issues (no general SQL parsing), keyed by matching the literal SQL text.
type FakeRow = Record<string, unknown>;

function createFakeState() {
  return {
    habitDefinitions: new Map<string, FakeRow>(), // key: id
    habitLogs: new Map<string, FakeRow>(), // key: `${habitDefinitionId}|${logDate}`
    syncQueue: [] as FakeRow[],
    nextQueueId: 1,
    meta: new Map<string, string>(),
  };
}

let state = createFakeState();

function fakeRunPersisted(_db: unknown, sql: string, params: unknown[] = []) {
  if (sql.startsWith("INSERT INTO habit_definitions")) {
    const [id, userId, slug, name, category, trackingMethod, frequency, config, isSystem, archivedAt, createdAt, updatedAt, deletedAt] = params;
    const existing = state.habitDefinitions.get(id as string);
    state.habitDefinitions.set(id as string, {
      id: existing?.id ?? id,
      user_id: userId,
      slug,
      name,
      category,
      tracking_method: trackingMethod,
      frequency,
      config,
      is_system: isSystem,
      archived_at: archivedAt,
      created_at: existing?.created_at ?? createdAt,
      updated_at: updatedAt,
      deleted_at: deletedAt,
    });
    return;
  }
  if (sql.startsWith("INSERT INTO habit_logs")) {
    const [id, userId, habitDefinitionId, logDate, payload, deviceId, createdAt, updatedAt, deletedAt] = params;
    const key = `${habitDefinitionId as string}|${logDate as string}`;
    const existing = state.habitLogs.get(key);
    state.habitLogs.set(key, {
      id: existing?.id ?? id,
      user_id: userId,
      habit_definition_id: habitDefinitionId,
      log_date: logDate,
      payload,
      device_id: deviceId,
      created_at: existing?.created_at ?? createdAt,
      updated_at: updatedAt,
      deleted_at: deletedAt,
    });
    return;
  }
  if (sql.startsWith("INSERT INTO sync_queue")) {
    const [entityType, entityId, payload, createdAt] = params;
    state.syncQueue.push({
      id: state.nextQueueId++,
      entity_type: entityType,
      entity_id: entityId,
      payload,
      created_at: createdAt,
    });
    return;
  }
  if (sql.startsWith("DELETE FROM sync_queue")) {
    const [id] = params;
    state.syncQueue = state.syncQueue.filter((r) => r.id !== id);
    return;
  }
  throw new Error(`fakeRunPersisted: unhandled SQL: ${sql}`);
}

function makeStatement(rows: FakeRow[]) {
  let i = -1;
  return {
    step: () => {
      i += 1;
      return i < rows.length;
    },
    getAsObject: () => rows[i],
    bind: () => {},
    free: () => {},
  };
}

function fakePrepare(sql: string) {
  if (sql.includes("FROM sync_queue")) {
    return makeStatement([...state.syncQueue].sort((a, b) => (a.id as number) - (b.id as number)));
  }
  if (sql.includes("SELECT COUNT(*) AS c FROM habit_definitions")) {
    const count = [...state.habitDefinitions.values()].filter((r) => !r.deleted_at).length;
    return makeStatement([{ c: count }]);
  }
  if (sql.includes("SELECT * FROM habit_definitions")) {
    return makeStatement([...state.habitDefinitions.values()].filter((r) => !r.deleted_at));
  }
  throw new Error(`fakePrepare: unhandled SQL: ${sql}`);
}

const fakeDb = { prepare: fakePrepare };

vi.mock("../db/local-db", () => ({
  getLocalDb: vi.fn(async () => fakeDb),
  getMeta: vi.fn((_db: unknown, key: string) => state.meta.get(key) ?? null),
  setMeta: vi.fn((_db: unknown, key: string, value: string) => {
    state.meta.set(key, value);
  }),
  runPersisted: vi.fn(fakeRunPersisted),
}));

const {
  createLocalCustomHabit,
  saveHabitLogLocally,
  syncWhenOnline,
  countLocalDefinitions,
  getLocalDefinitions,
  updateLocalDefinitionConfig,
  validateCustomHabitName,
} = await import("./sync-engine");

beforeEach(() => {
  state = createFakeState();
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("navigator", { onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("validateCustomHabitName", () => {
  it("rejects an empty name", () => {
    expect(validateCustomHabitName("")).toMatch(/empty/i);
  });

  it("rejects a name over 120 characters", () => {
    expect(validateCustomHabitName("a".repeat(121))).toMatch(/120/);
  });

  it("accepts a normal name", () => {
    expect(validateCustomHabitName("Skincare")).toBeNull();
  });
});

describe("createLocalCustomHabit", () => {
  it("rejects an empty (or whitespace-only) name without touching storage", async () => {
    await expect(createLocalCustomHabit("   ")).rejects.toThrow(/empty/i);
    expect(state.habitDefinitions.size).toBe(0);
    expect(state.syncQueue).toHaveLength(0);
  });

  it("writes a definition locally and enqueues it for sync", async () => {
    const dto = await createLocalCustomHabit("Skincare");
    expect(dto.name).toBe("Skincare");
    expect(dto.slug).toMatch(/^skincare-/);
    expect(dto.isSystem).toBe(false);
    expect(state.habitDefinitions.get(dto.id)).toBeDefined();
    expect(state.syncQueue).toHaveLength(1);
    expect(state.syncQueue[0].entity_type).toBe("habit_definition");
  });

  it("trims surrounding whitespace before saving", async () => {
    const dto = await createLocalCustomHabit("  Reading  ");
    expect(dto.name).toBe("Reading");
  });
});

describe("saveHabitLogLocally", () => {
  it("creates a new log row and enqueues it", async () => {
    const dto = await saveHabitLogLocally("def-1", "2026-09-28", { completed: true });
    expect(dto.habitDefinitionId).toBe("def-1");
    expect(state.habitLogs.get("def-1|2026-09-28")).toBeDefined();
    expect(state.syncQueue).toHaveLength(1);
    expect(state.syncQueue[0].entity_type).toBe("habit_log");
  });

  it("preserves the original id and createdAt when updating the same (habit, date)", async () => {
    const first = await saveHabitLogLocally("def-1", "2026-09-28", { completed: false });
    const second = await saveHabitLogLocally("def-1", "2026-09-28", { completed: true });

    expect(second.id).not.toBe(first.id); // caller always generates a fresh id...
    const stored = state.habitLogs.get("def-1|2026-09-28");
    expect(stored?.id).toBe(first.id); // ...but storage keeps the original row's id
    expect(stored?.created_at).toBe(first.createdAt);
    expect(stored?.payload).toBe(JSON.stringify({ completed: true }));
  });

  it("generates and persists a device id on first write, then reuses it", async () => {
    const first = await saveHabitLogLocally("def-1", "2026-09-28", {});
    const second = await saveHabitLogLocally("def-1", "2026-09-29", {});
    expect(first.deviceId).toBe(second.deviceId);
  });
});

describe("updateLocalDefinitionConfig", () => {
  it("merges the patch into existing config, bumps updatedAt, and enqueues the definition", async () => {
    const created = await createLocalCustomHabit("Steps-like");
    state.syncQueue = [];
    // Seed some existing config to prove it's merged, not replaced.
    await updateLocalDefinitionConfig(created.id, { unit: "steps", goal: 10000 });
    state.syncQueue = [];

    const updated = await updateLocalDefinitionConfig(created.id, { goal: 8000 });

    expect(updated.config).toEqual({ unit: "steps", goal: 8000 });
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(created.updatedAt));
    const stored = getLocalDefinitions(fakeDb as never).find((d) => d.id === created.id);
    expect(stored?.config).toEqual({ unit: "steps", goal: 8000 });
    expect(state.syncQueue).toHaveLength(1);
    expect(state.syncQueue[0].entity_type).toBe("habit_definition");
  });

  it("throws for an unknown definition without writing anything", async () => {
    await expect(updateLocalDefinitionConfig("missing", { goal: 1 })).rejects.toThrow(/not found/i);
    expect(state.syncQueue).toHaveLength(0);
  });
});

describe("countLocalDefinitions / getLocalDefinitions", () => {
  it("reflects writes made through createLocalCustomHabit", async () => {
    expect(countLocalDefinitions(fakeDb as never)).toBe(0);
    await createLocalCustomHabit("Habit A");
    await createLocalCustomHabit("Habit B");
    expect(countLocalDefinitions(fakeDb as never)).toBe(2);
    expect(getLocalDefinitions(fakeDb as never)).toHaveLength(2);
  });
});

describe("syncWhenOnline", () => {
  it("returns offline immediately when navigator.onLine is false, without calling fetch", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const result = await syncWhenOnline();
    expect(result.online).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("pushes the queue, pulls fresh data, and reports online on success", async () => {
    await createLocalCustomHabit("Habit A"); // queues one push item

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Response(null, { status: 204 });
      }
      return new Response(
        JSON.stringify({
          serverTime: "2026-09-28T00:00:00.000Z",
          habitDefinitions: [],
          habitLogs: [],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncWhenOnline();
    expect(result.online).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(state.syncQueue).toHaveLength(0); // push cleared the queue
    expect(state.meta.get("last_sync_at")).toBe("2026-09-28T00:00:00.000Z");
  });

  it("falls back to offline and keeps the queue intact when the push request fails", async () => {
    await createLocalCustomHabit("Habit A");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );

    const result = await syncWhenOnline();
    expect(result.online).toBe(false);
    expect(state.syncQueue).toHaveLength(1); // not cleared — push never succeeded
  });

  it("falls back to offline when the pull request fails after a successful push", async () => {
    await createLocalCustomHabit("Habit A");

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(null, { status: 204 });
      return new Response(null, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncWhenOnline();
    expect(result.online).toBe(false);
    // Push already succeeded and cleared the queue before the pull failed.
    expect(state.syncQueue).toHaveLength(0);
  });
});
