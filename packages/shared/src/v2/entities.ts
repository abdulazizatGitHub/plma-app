import { z } from "zod";
import { clockSchema, idSchema, instantSchema, localDateSchema, syncedRowSchema } from "./primitives.js";
import { anchorSchema, scheduleSchema, trackingSchema, triggerSchema } from "./tracking.js";

/*
 * v2 domain rows (docs/architecture/SYSTEM_DESIGN.md §4). These are the shapes
 * synced between device and server; Postgres and local SQLite store the same
 * columns in snake_case.
 */

export const ITEM_TYPES = ["task", "habit", "goal", "plan", "group"] as const;
export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const OCCURRENCE_STATUSES = ["todo", "in_progress", "done", "skipped", "moved", "missed"] as const;
export const VISIBILITIES = ["private", "friends", "everyone"] as const;

const provenance = {
  sourceTemplateId: idSchema.nullable(),
  sourceTemplateVersion: z.number().int().nullable(),
  adoptedAt: instantSchema.nullable(),
};

export const userSettingsSchema = syncedRowSchema.extend({
  /** IANA zone, e.g. Asia/Karachi. */
  timezone: z.string().min(1).max(64),
  weekStart: z.number().int().min(0).max(6),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  locationLabel: z.string().max(80).nullable(),
  /** Prayer-time method; default Karachi (owner A-1). */
  calcMethod: z.string().min(1).max(32),
  madhab: z.enum(["hanafi", "shafi"]),
  /** Minutes added per prayer key to match the local mosque. */
  prayerOffsets: z.record(z.string(), z.number().int().min(-30).max(30)),
  dayParts: z.array(z.object({ key: z.string().min(1).max(32), label: z.string().min(1).max(40), start: anchorSchema })).max(12),
  quietFrom: clockSchema.nullable(),
  quietTo: clockSchema.nullable(),
  /** Who sees achievements & progress (owner A-3, SOC-06). */
  visibility: z.enum(VISIBILITIES),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const categorySchema = syncedRowSchema.extend({
  name: z.string().trim().min(1).max(60),
  icon: z.string().min(1).max(40),
  color: z.string().min(1).max(24),
  sortOrder: z.number().int(),
  archivedAt: instantSchema.nullable(),
  ...provenance,
});
export type Category = z.infer<typeof categorySchema>;

export const itemSchema = syncedRowSchema.extend({
  categoryId: idSchema.nullable(),
  parentId: idSchema.nullable(),
  type: z.enum(ITEM_TYPES),
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(4000).nullable(),
  priority: z.enum(PRIORITIES),
  isOptional: z.boolean(),
  tracking: trackingSchema,
  schedule: scheduleSchema,
  /** Preset-specific fields: venue, platform, course, prayerKey… */
  meta: z.record(z.string(), z.unknown()),
  groupGoalId: idSchema.nullable(),
  sortOrder: z.number().int(),
  archivedAt: instantSchema.nullable(),
  ...provenance,
});
export type Item = z.infer<typeof itemSchema>;

export const itemDependencySchema = syncedRowSchema.extend({
  itemId: idSchema,
  dependsOnId: idSchema,
});
export type ItemDependency = z.infer<typeof itemDependencySchema>;

export const cadenceRuleSchema = syncedRowSchema.extend({
  categoryId: idSchema.nullable(),
  planItemId: idSchema.nullable(),
  stepKind: z.string().min(1).max(40),
  rule: z.discriminatedUnion("type", [
    z.object({ type: z.literal("gapDays"), n: z.number().int().min(1).max(60) }),
    z.object({ type: z.literal("weekdays"), days: z.array(z.number().int().min(0).max(6)).min(1).max(7) }),
  ]),
});
export type CadenceRule = z.infer<typeof cadenceRuleSchema>;

export const occurrenceSchema = syncedRowSchema.extend({
  itemId: idSchema,
  /** null = pending (no date). */
  date: localDateSchema.nullable(),
  slot: z.string().max(32),
  status: z.enum(OCCURRENCE_STATUSES),
  value: z.number().nullable(),
  /** Checklist states, qada flag, sleep bed/wake, exercise type… */
  detail: z.record(z.string(), z.unknown()).nullable(),
  movedTo: localDateSchema.nullable(),
  movedFrom: localDateSchema.nullable(),
  startedAt: instantSchema.nullable(),
  completedAt: instantSchema.nullable(),
  deviceId: z.string().max(64).nullable(),
});
export type Occurrence = z.infer<typeof occurrenceSchema>;

export const reminderSchema = syncedRowSchema.extend({
  itemId: idSchema,
  trigger: triggerSchema,
  repeatEveryMin: z.number().int().min(5).max(1440).nullable(),
  repeatUntilDone: z.boolean(),
  maxRepeats: z.number().int().min(0).max(48),
  enabled: z.boolean(),
  /** Computed by the server; clients send null. */
  nextFireAt: instantSchema.nullable(),
});
export type Reminder = z.infer<typeof reminderSchema>;

/** Defaults for a brand-new account (owner decisions A-1, A-3). */
export function defaultUserSettings(userId: string, now: string, timezone = "Asia/Karachi"): UserSettings {
  return {
    id: userId,
    userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    timezone,
    weekStart: 1,
    lat: null,
    lng: null,
    locationLabel: null,
    calcMethod: "karachi",
    madhab: "hanafi",
    prayerOffsets: {},
    dayParts: [],
    quietFrom: null,
    quietTo: null,
    visibility: "friends",
  };
}
