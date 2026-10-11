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
    nextFireAt: ts("next_fire_at"),
    ...syncedColumns,
  },
  (t) => [
    index("reminders_user_synced_idx").on(t.userId, t.syncedAt),
    index("reminders_next_fire_idx").on(t.nextFireAt),
  ],
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
