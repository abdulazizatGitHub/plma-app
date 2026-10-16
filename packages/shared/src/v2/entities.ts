import { z } from "zod";
import { clockSchema, idSchema, instantSchema, localDateSchema, syncedRowSchema } from "./primitives.js";
import { DEFAULT_REMINDER_PROFILES, reminderProfilesSchema } from "./reminders/model.js";
import { anchorSchema, scheduleSchema, trackingSchema, triggerSchema } from "./tracking.js";

/*
 * v2 domain rows (docs/architecture/SYSTEM_DESIGN.md §4). These are the shapes
 * synced between device and server; Postgres and local SQLite store the same
 * columns in snake_case.
 */

export const ITEM_TYPES = ["task", "habit", "goal", "plan", "group"] as const;
export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const OCCURRENCE_STATUSES = ["todo", "in_progress", "done", "skipped", "moved", "missed"] as const;
/** Who sees my progress and achievements (SOC-06): "selected" = an allow-list of friends (owner, 2026-10-16). */
export const VISIBILITIES = ["private", "friends", "selected", "everyone"] as const;

const provenance = {
  sourceTemplateId: idSchema.nullable(),
  sourceTemplateVersion: z.number().int().nullable(),
  adoptedAt: instantSchema.nullable(),
};

/**
 * A column added after devices already had the table: their local copy holds
 * NULL until the next pull refills it, so NULL reads as the default.
 */
const added = <T extends z.ZodType>(schema: T, fallback: z.input<T>) => z.preprocess((v) => v ?? fallback, schema);

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
  /** Fixed times that replace the calculated ones, per prayer key (PRY-05). */
  prayerManual: z.record(z.string(), clockSchema).default({}),
  /** On Fridays the Zuhr chip reads "Jumu'ah" (owner, 2026-10-11). */
  jumuahLabel: z.boolean().default(true),
  /** When the user's day ends and locks: 0 = midnight … 4 = 4 AM (night owls). */
  dayEndHour: z.number().int().min(0).max(4).default(0),
  /** How the location was chosen: device GPS, a picked city, never, or not asked yet. */
  locationMode: z.enum(["unset", "device", "city", "never"]).default("unset"),
  quietFrom: clockSchema.nullable(),
  quietTo: clockSchema.nullable(),
  /** The global reminders switch (REM-04). */
  notificationsEnabled: added(z.boolean(), true),
  /** Reminder window per priority (REM-02), editable in Settings. */
  reminderProfiles: added(reminderProfilesSchema, DEFAULT_REMINDER_PROFILES),
  /** When untimed items are reminded. */
  checkinTime: added(clockSchema, "20:00"),
  /** Optional nudges (REM-06); null = off. */
  planTomorrowAt: clockSchema.nullable().default(null),
  morningSummaryAt: clockSchema.nullable().default(null),
  /** Days added to the Umm al-Qura Hijri date for seasonal awards (−1 where months start a day later). */
  hijriOffset: added(z.number().int().min(-2).max(2), 0),
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
  /** Its items don't remind (REM-04). */
  remindersMuted: added(z.boolean(), false),
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
  /** Snooze length; null = the priority's. */
  snoozeMin: z.number().int().min(1).max(240).nullable().default(null),
  /** Days of the week it reminds (0 = Sunday), like an alarm; null = every day the item is due. */
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7).nullable().default(null),
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
    prayerManual: {},
    jumuahLabel: true,
    dayEndHour: 0,
    locationMode: "unset",
    quietFrom: null,
    quietTo: null,
    notificationsEnabled: true,
    reminderProfiles: DEFAULT_REMINDER_PROFILES,
    checkinTime: "20:00",
    planTomorrowAt: null,
    morningSummaryAt: null,
    hijriOffset: 0,
    visibility: "friends",
  };
}
