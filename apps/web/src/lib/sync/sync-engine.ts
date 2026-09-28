"use client";

import {
  createHabitDefinitionSchema,
  uniqueSlug,
  type HabitDefinitionDto,
  type HabitLogDto,
} from "@life/shared";
import type { Database } from "sql.js";
import {
  getLocalDb,
  getMeta,
  runPersisted,
  setMeta,
} from "../db/local-db";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const PENDING_USER = "00000000-0000-0000-0000-000000000001";

export function upsertDefinition(db: Database, item: HabitDefinitionDto) {
  runPersisted(
    db,
    `INSERT INTO habit_definitions (
      id, user_id, slug, name, category, tracking_method, frequency,
      config, is_system, archived_at, created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      name = excluded.name,
      category = excluded.category,
      tracking_method = excluded.tracking_method,
      frequency = excluded.frequency,
      config = excluded.config,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at`,
    [
      item.id,
      item.userId,
      item.slug,
      item.name,
      item.category,
      item.trackingMethod,
      item.frequency,
      JSON.stringify(item.config),
      item.isSystem ? 1 : 0,
      item.archivedAt,
      item.createdAt,
      item.updatedAt,
      item.deletedAt,
    ],
  );

  if (item.userId && item.userId !== PENDING_USER) {
    setMeta(db, "user_id", item.userId);
  }
}

export function upsertLog(db: Database, item: HabitLogDto) {
  runPersisted(
    db,
    `INSERT INTO habit_logs (
      id, user_id, habit_definition_id, log_date, payload,
      device_id, created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(habit_definition_id, log_date) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at`,
    [
      item.id,
      item.userId,
      item.habitDefinitionId,
      item.logDate,
      JSON.stringify(item.payload),
      item.deviceId,
      item.createdAt,
      item.updatedAt,
      item.deletedAt,
    ],
  );
}

export function enqueue(
  db: Database,
  entityType: "habit_definition" | "habit_log",
  entityId: string,
  payload: Record<string, unknown>,
) {
  runPersisted(
    db,
    `INSERT INTO sync_queue (entity_type, entity_id, payload, created_at)
     VALUES (?, ?, ?, ?)`,
    [entityType, entityId, JSON.stringify(payload), new Date().toISOString()],
  );
}

async function pushQueue(db: Database): Promise<void> {
  const deviceId = getMeta(db, "device_id") ?? crypto.randomUUID();
  if (!getMeta(db, "device_id")) setMeta(db, "device_id", deviceId);

  const stmt = db.prepare(
    "SELECT id, entity_type, payload FROM sync_queue ORDER BY id ASC",
  );
  const rows: { id: number; entity_type: string; payload: string }[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as { id: number; entity_type: string; payload: string });
  }
  stmt.free();

  if (!rows.length) return;

  const habitDefinitions: HabitDefinitionDto[] = [];
  const habitLogs: HabitLogDto[] = [];

  for (const row of rows) {
    const parsed = JSON.parse(row.payload) as HabitDefinitionDto | HabitLogDto;
    if (row.entity_type === "habit_definition") {
      habitDefinitions.push(parsed as HabitDefinitionDto);
    } else if (row.entity_type === "habit_log") {
      habitLogs.push(parsed as HabitLogDto);
    }
  }

  const res = await fetch(`${API_BASE}/v1/sync/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, habitDefinitions, habitLogs }),
  });

  if (!res.ok) throw new Error(`Sync push failed: ${res.status}`);

  for (const row of rows) {
    runPersisted(db, "DELETE FROM sync_queue WHERE id = ?", [row.id]);
  }
}

export async function pullFromServer(): Promise<number> {
  const db = await getLocalDb();
  const since = getMeta(db, "last_sync_at");
  const url = since
    ? `${API_BASE}/v1/sync/pull?since=${encodeURIComponent(since)}`
    : `${API_BASE}/v1/sync/pull`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sync pull failed: ${res.status}`);

  const data = (await res.json()) as {
    serverTime: string;
    habitDefinitions: HabitDefinitionDto[];
    habitLogs: HabitLogDto[];
  };

  for (const def of data.habitDefinitions) upsertDefinition(db, def);
  for (const log of data.habitLogs) upsertLog(db, log);

  setMeta(db, "last_sync_at", data.serverTime);
  return data.habitDefinitions.length;
}

export function countLocalDefinitions(db: Database): number {
  const stmt = db.prepare(
    "SELECT COUNT(*) AS c FROM habit_definitions WHERE deleted_at IS NULL",
  );
  stmt.step();
  const row = stmt.getAsObject() as { c: number };
  stmt.free();
  return Number(row.c);
}

export function getLocalDefinitions(db: Database): HabitDefinitionDto[] {
  const stmt = db.prepare(
    `SELECT * FROM habit_definitions WHERE deleted_at IS NULL ORDER BY is_system DESC, name ASC`,
  );
  const items: HabitDefinitionDto[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    items.push({
      id: String(row.id),
      userId: String(row.user_id),
      slug: String(row.slug),
      name: String(row.name),
      category: String(row.category),
      trackingMethod: String(row.tracking_method),
      frequency: String(row.frequency),
      config: JSON.parse(String(row.config)) as Record<string, unknown>,
      isSystem: Number(row.is_system) === 1,
      archivedAt: row.archived_at ? String(row.archived_at) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    });
  }
  stmt.free();
  return items;
}

export function validateCustomHabitName(name: string): string | null {
  const result = createHabitDefinitionSchema.shape.name.safeParse(name);
  if (result.success) return null;
  const issue = result.error.issues[0];
  if (issue?.code === "too_small") return "Habit name can't be empty.";
  if (issue?.code === "too_big") return "Habit name must be 120 characters or fewer.";
  return "Enter a valid habit name.";
}

export async function createLocalCustomHabit(name: string): Promise<HabitDefinitionDto> {
  const trimmed = name.trim();
  const validationError = validateCustomHabitName(trimmed);
  if (validationError) throw new Error(validationError);

  const db = await getLocalDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const slug = uniqueSlug(trimmed, id);
  const userId = getMeta(db, "user_id") ?? PENDING_USER;

  const dto: HabitDefinitionDto = {
    id,
    userId,
    slug,
    name: trimmed,
    category: "custom",
    trackingMethod: "boolean",
    frequency: "daily",
    config: {},
    isSystem: false,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  upsertDefinition(db, dto);
  enqueue(db, "habit_definition", id, dto as unknown as Record<string, unknown>);
  return dto;
}

/**
 * Writes a habit log to the local SQLite store and enqueues it for sync.
 * Always assigns a fresh id — the (habit_definition_id, log_date) unique
 * index resolves the upsert, and the pre-existing row's id/created_at are
 * preserved by the UPDATE branch (see upsertLog).
 */
export async function saveHabitLogLocally(
  habitDefinitionId: string,
  logDate: string,
  payload: Record<string, unknown>,
): Promise<HabitLogDto> {
  const db = await getLocalDb();
  const userId = getMeta(db, "user_id") ?? PENDING_USER;
  let deviceId = getMeta(db, "device_id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    setMeta(db, "device_id", deviceId);
  }
  const now = new Date().toISOString();

  const dto: HabitLogDto = {
    id: crypto.randomUUID(),
    userId,
    habitDefinitionId,
    logDate,
    payload,
    deviceId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  upsertLog(db, dto);
  enqueue(db, "habit_log", dto.id, dto as unknown as Record<string, unknown>);
  return dto;
}

export async function syncWhenOnline(): Promise<{ habits: number; online: boolean }> {
  const db = await getLocalDb();

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { habits: countLocalDefinitions(db), online: false };
  }

  try {
    await pushQueue(db);
    const habits = await pullFromServer();
    return { habits, online: true };
  } catch {
    return { habits: countLocalDefinitions(db), online: false };
  }
}
