import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** App profile. For v2 accounts `id` equals the Supabase Auth user id (JWT `sub`). */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  /** Days up to here are closed: open repeating items were written down as missed (Phase 7). */
  closedThrough: date("closed_through"),
  /** Rewards were scored for past days (Phase 8); set once, on the first rewards read or closing. */
  rewardsBuiltAt: timestamp("rewards_built_at", { withTimezone: true }),
});

export const devices = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const habitDefinitions = pgTable(
  "habit_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    trackingMethod: text("tracking_method").notNull(),
    frequency: text("frequency").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().default({}).notNull(),
    isSystem: boolean("is_system").default(false).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("habit_definitions_user_slug_idx").on(table.userId, table.slug),
  ],
);

export const habitLogs = pgTable(
  "habit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    habitDefinitionId: uuid("habit_definition_id")
      .notNull()
      .references(() => habitDefinitions.id, { onDelete: "cascade" }),
    logDate: date("log_date").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    deviceId: text("device_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("habit_logs_def_date_idx").on(
      table.habitDefinitionId,
      table.logDate,
    ),
  ],
);

// ---------------------------------------------------------------- v2 (SYSTEM_DESIGN §4)
// Synced tables keep the client's created/updated/deleted timestamps (updated_at
// drives last-write-wins) plus `synced_at`, the server time of the last write,
// which is the pull cursor (immune to device clock skew).

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const syncedColumns = {
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
  deletedAt: ts("deleted_at"),
  syncedAt: ts("synced_at").defaultNow().notNull(),
};
const provenanceColumns = {
  sourceTemplateId: uuid("source_template_id"),
  sourceTemplateVersion: integer("source_template_version"),
  adoptedAt: ts("adopted_at"),
};
const owner = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const userSettings = pgTable("user_settings", {
  id: uuid("id").primaryKey(),
  userId: owner().unique(),
  timezone: text("timezone").notNull(),
  weekStart: smallint("week_start").notNull().default(1),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  locationLabel: text("location_label"),
  calcMethod: text("calc_method").notNull().default("karachi"),
  madhab: text("madhab").notNull().default("hanafi"),
  prayerOffsets: jsonb("prayer_offsets").$type<Record<string, number>>().notNull().default({}),
  dayParts: jsonb("day_parts").$type<unknown[]>().notNull().default([]),
  prayerManual: jsonb("prayer_manual").$type<Record<string, string>>().notNull().default({}),
  jumuahLabel: boolean("jumuah_label").notNull().default(true),
  locationMode: text("location_mode").notNull().default("unset"),
  dayEndHour: smallint("day_end_hour").notNull().default(0),
  quietFrom: text("quiet_from"),
  quietTo: text("quiet_to"),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  reminderProfiles: jsonb("reminder_profiles")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({
      low: { enabled: false, leadMin: 0, repeatEveryMin: null, maxRepeats: 0, snoozeMin: 10 },
      medium: { enabled: true, leadMin: 0, repeatEveryMin: null, maxRepeats: 0, snoozeMin: 10 },
      high: { enabled: true, leadMin: 0, repeatEveryMin: 30, maxRepeats: 1, snoozeMin: 10 },
      critical: { enabled: true, leadMin: 0, repeatEveryMin: 30, maxRepeats: 6, snoozeMin: 10 },
    }),
  checkinTime: text("checkin_time").notNull().default("20:00"),
  planTomorrowAt: text("plan_tomorrow_at"),
  morningSummaryAt: text("morning_summary_at"),
  visibility: text("visibility").notNull().default("friends"),
  ...syncedColumns,
});

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey(),
    userId: owner(),
    name: text("name").notNull(),
    icon: text("icon").notNull(),
    color: text("color").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: ts("archived_at"),
    remindersMuted: boolean("reminders_muted").notNull().default(false),
    ...provenanceColumns,
    ...syncedColumns,
  },
  (t) => [index("categories_user_synced_idx").on(t.userId, t.syncedAt)],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey(),
    userId: owner(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    parentId: uuid("parent_id"),
    type: text("type").notNull(),
    title: text("title").notNull(),
    notes: text("notes"),
    priority: text("priority").notNull().default("medium"),
    isOptional: boolean("is_optional").notNull().default(false),
    tracking: jsonb("tracking").$type<Record<string, unknown>>().notNull(),
    schedule: jsonb("schedule").$type<Record<string, unknown>>().notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    groupGoalId: uuid("group_goal_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: ts("archived_at"),
    ...provenanceColumns,
    ...syncedColumns,
  },
  (t) => [
    index("items_user_synced_idx").on(t.userId, t.syncedAt),
    index("items_category_idx").on(t.categoryId),
    index("items_parent_idx").on(t.parentId),
  ],
);

export const itemDependencies = pgTable(
  "item_dependencies",
  {
    id: uuid("id").primaryKey(),
    userId: owner(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    dependsOnId: uuid("depends_on_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    ...syncedColumns,
  },
  (t) => [index("item_dependencies_user_synced_idx").on(t.userId, t.syncedAt)],
);

export const cadenceRules = pgTable(
  "cadence_rules",
  {
    id: uuid("id").primaryKey(),
    userId: owner(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }),
    planItemId: uuid("plan_item_id").references(() => items.id, { onDelete: "cascade" }),
    stepKind: text("step_kind").notNull(),
    rule: jsonb("rule").$type<Record<string, unknown>>().notNull(),
    ...syncedColumns,
  },
  (t) => [index("cadence_rules_user_synced_idx").on(t.userId, t.syncedAt)],
);

export const occurrences = pgTable(
  "occurrences",
  {
    id: uuid("id").primaryKey(),
    userId: owner(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    /** null = pending (no date). */
    date: date("date", { mode: "string" }),
    slot: text("slot").notNull().default(""),
    status: text("status").notNull(),
    value: doublePrecision("value"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    movedTo: date("moved_to", { mode: "string" }),
    movedFrom: date("moved_from", { mode: "string" }),
    startedAt: ts("started_at"),
    completedAt: ts("completed_at"),
    deviceId: text("device_id"),
    ...syncedColumns,
  },
  (t) => [
    index("occurrences_user_synced_idx").on(t.userId, t.syncedAt),
    index("occurrences_user_date_idx").on(t.userId, t.date),
    uniqueIndex("occurrences_item_date_slot_idx")
      .on(t.itemId, t.date, t.slot)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey(),
    userId: owner(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    trigger: jsonb("trigger").$type<Record<string, unknown>>().notNull(),
    repeatEveryMin: integer("repeat_every_min"),
    repeatUntilDone: boolean("repeat_until_done").notNull().default(false),
    maxRepeats: integer("max_repeats").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    snoozeMin: integer("snooze_min"),
    days: jsonb("days").$type<number[]>(),
    nextFireAt: ts("next_fire_at"),
    ...syncedColumns,
  },
  (t) => [
    index("reminders_user_synced_idx").on(t.userId, t.syncedAt),
    index("reminders_next_fire_idx").on(t.nextFireAt),
    // One active reminder per item (owner, 2026-10-12). Not a unique index: two offline
    // devices may each create one; the latest live row wins (shared `customReminders`).
    index("reminders_item_idx").on(t.itemId),
  ],
);

/** Web Push endpoints (server-only, never synced). One row per browser/device. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: owner(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    failures: integer("failures").notNull().default(0),
    lastSuccessAt: ts("last_success_at"),
    createdAt: ts("created_at").defaultNow().notNull(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

/**
 * Upcoming reminder fires (server-only). The planner rewrites a user's pending
 * rows from the shared `plannedFires`; the tick sends the due ones.
 */
export const reminderQueue = pgTable(
  "reminder_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: owner(),
    /** item|date|slot|attempt, or nudge:kind|date — one row per fire. */
    key: text("key").notNull(),
    kind: text("kind").notNull(),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    slot: text("slot").notNull().default(""),
    attempt: integer("attempt").notNull().default(0),
    fireAt: ts("fire_at").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    snoozeMin: integer("snooze_min").notNull().default(10),
    /** pending → sent | skipped (done by then) | failed. */
    status: text("status").notNull().default("pending"),
    createdAt: ts("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("reminder_queue_user_key_idx").on(t.userId, t.key),
    index("reminder_queue_due_idx").on(t.status, t.fireAt),
  ],
);

/** What was actually sent (REM history, debugging). */
export const reminderDeliveries = pgTable(
  "reminder_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: owner(),
    key: text("key").notNull(),
    itemId: uuid("item_id"),
    sentAt: ts("sent_at").defaultNow().notNull(),
    devices: integer("devices").notNull().default(0),
    action: text("action"),
  },
  (t) => [index("reminder_deliveries_user_idx").on(t.userId, t.sentAt)],
);

/**
 * Rewards (Phase 8, server-only, never synced): one scored row per user and
 * day, recomputed from that day's entries. Closed days are scored once at
 * closing and stay as they are; open days are re-scored on every read.
 */
export const rewardDays = pgTable(
  "reward_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: owner(),
    date: date("date").notNull(),
    due: integer("due").notNull().default(0),
    done: integer("done").notNull().default(0),
    complete: boolean("complete").notNull().default(false),
    perfect: boolean("perfect").notNull().default(false),
    allPrayers: boolean("all_prayers"),
    points: integer("points").notNull().default(0),
    updatedAt: ts("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("reward_days_user_date_idx").on(t.userId, t.date)],
);

/** Badges earned (awarded once, never taken back); `seenAt` = celebrated. */
export const userBadges = pgTable(
  "user_badges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: owner(),
    badgeId: text("badge_id").notNull(),
    earnedAt: ts("earned_at").defaultNow().notNull(),
    seenAt: ts("seen_at"),
  },
  (t) => [uniqueIndex("user_badges_user_badge_idx").on(t.userId, t.badgeId)],
);

/** Starter packs and (Phase 12) public templates. Server-managed, never synced from clients. */
export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  items: jsonb("items").$type<unknown[]>().notNull().default([]),
  version: integer("version").notNull().default(1),
  visibility: text("visibility").notNull().default("private"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type HabitDefinition = typeof habitDefinitions.$inferSelect;
export type HabitLog = typeof habitLogs.$inferSelect;
