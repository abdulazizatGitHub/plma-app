import { z } from "zod";

export const habitDefinitionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  trackingMethod: z.string(),
  frequency: z.string(),
  config: z.record(z.string(), z.unknown()),
  isSystem: z.boolean(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export type HabitDefinitionDto = z.infer<typeof habitDefinitionSchema>;

export const createHabitDefinitionSchema = z.object({
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(64).default("custom"),
  trackingMethod: z
    .enum(["boolean", "counter", "duration", "timer", "text"])
    .default("boolean"),
  frequency: z
    .enum(["daily", "nightly", "weekly_friday", "weekly", "custom"])
    .default("daily"),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const habitLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  habitDefinitionId: z.string().uuid(),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payload: z.record(z.string(), z.unknown()),
  deviceId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
});

export type HabitLogDto = z.infer<typeof habitLogSchema>;

export const upsertHabitLogSchema = z.object({
  habitDefinitionId: z.string().uuid(),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payload: z.record(z.string(), z.unknown()),
  deviceId: z.string().optional(),
});
