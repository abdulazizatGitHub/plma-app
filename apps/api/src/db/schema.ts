import {
  boolean,
  date,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name"),
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

export type HabitDefinition = typeof habitDefinitions.$inferSelect;
export type HabitLog = typeof habitLogs.$inferSelect;
