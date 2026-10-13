import { z } from "zod";
import {
  cadenceRuleSchema,
  categorySchema,
  itemDependencySchema,
  itemSchema,
  occurrenceSchema,
  reminderSchema,
  userSettingsSchema,
} from "./entities.js";
import { instantSchema } from "./primitives.js";

/**
 * Every entity the device syncs, in dependency order (parents before rows that
 * reference them). Server-only tables (rewards, social, templates…) are never
 * accepted from a client.
 */
export const SYNC_ENTITIES = [
  "userSettings",
  "categories",
  "items",
  "itemDependencies",
  "cadenceRules",
  "occurrences",
  "reminders",
] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

type EntitySpec = {
  schema: z.ZodObject;
  table: string;
  /** Columns stored as JSON text (SQLite) / jsonb (Postgres). */
  json: readonly string[];
  /** Columns stored as 0/1 in SQLite. */
  bool: readonly string[];
  /** Foreign keys that must point at rows the caller owns: column → entity. */
  refs: Readonly<Record<string, SyncEntity>>;
};

export const ENTITY_SPECS: Record<SyncEntity, EntitySpec> = {
  userSettings: {
    schema: userSettingsSchema,
    table: "user_settings",
    json: ["prayerOffsets", "dayParts", "prayerManual", "reminderProfiles"],
    bool: ["jumuahLabel", "notificationsEnabled"],
    refs: {},
  },
  categories: { schema: categorySchema, table: "categories", json: [], bool: ["remindersMuted"], refs: {} },
  items: {
    schema: itemSchema,
    table: "items",
    json: ["tracking", "schedule", "meta"],
    bool: ["isOptional"],
    refs: { categoryId: "categories", parentId: "items" },
  },
  itemDependencies: {
    schema: itemDependencySchema,
    table: "item_dependencies",
    json: [],
    bool: [],
    refs: { itemId: "items", dependsOnId: "items" },
  },
  cadenceRules: {
    schema: cadenceRuleSchema,
    table: "cadence_rules",
    json: ["rule"],
    bool: [],
    refs: { categoryId: "categories", planItemId: "items" },
  },
  occurrences: {
    schema: occurrenceSchema,
    table: "occurrences",
    json: ["detail"],
    bool: [],
    refs: { itemId: "items" },
  },
  reminders: {
    schema: reminderSchema,
    table: "reminders",
    json: ["trigger", "days"],
    bool: ["repeatUntilDone", "enabled"],
    refs: { itemId: "items" },
  },
};

export const camelToSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
export const snakeToCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** Column names (camelCase) of an entity, in schema order. */
export function entityColumns(entity: SyncEntity): string[] {
  return Object.keys(ENTITY_SPECS[entity].schema.shape);
}

export const syncChangeSchema = z.object({
  entity: z.enum(SYNC_ENTITIES),
  row: z.record(z.string(), z.unknown()),
});
export type SyncChange = z.infer<typeof syncChangeSchema>;

export const syncPushBodyV2Schema = z.object({
  deviceId: z.string().max(64).optional(),
  changes: z.array(syncChangeSchema).max(500),
});
export type SyncPushBodyV2 = z.infer<typeof syncPushBodyV2Schema>;

export const syncPullQueryV2Schema = z.object({
  /** Server cursor from the previous pull (`serverTime`). Omit for a full pull. */
  since: instantSchema.optional(),
});

export type SyncPullResponseV2 = {
  serverTime: string;
  changes: Partial<Record<SyncEntity, Record<string, unknown>[]>>;
  /** Days up to here are closed (final); history reads them from stored rows only. */
  closedThrough?: string | null;
};

export type SyncPushResponseV2 = {
  serverTime: string;
  accepted: number;
  /** Rows the server already had a newer version of (left unchanged). */
  stale: number;
};

/** Validates one pushed row against its entity schema. */
export function parseSyncRow(entity: SyncEntity, row: unknown) {
  return ENTITY_SPECS[entity].schema.safeParse(row);
}
