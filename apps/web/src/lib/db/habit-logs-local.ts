"use client";

import type { HabitLogDto } from "@life/shared";
import { getLocalDb } from "./local-db";

export async function getLocalHabitLogs(): Promise<HabitLogDto[]> {
  const db = await getLocalDb();
  const stmt = db.prepare(
    `SELECT * FROM habit_logs WHERE deleted_at IS NULL ORDER BY log_date DESC`,
  );
  const items: HabitLogDto[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    items.push({
      id: String(row.id),
      userId: String(row.user_id),
      habitDefinitionId: String(row.habit_definition_id),
      logDate: String(row.log_date),
      payload: JSON.parse(String(row.payload)) as Record<string, unknown>,
      deviceId: row.device_id ? String(row.device_id) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    });
  }
  stmt.free();
  return items;
}
