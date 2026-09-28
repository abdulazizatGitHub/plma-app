import { z } from "zod";
import { habitDefinitionSchema, habitLogSchema } from "./habits.js";

export const syncPushBodySchema = z.object({
  deviceId: z.string().uuid(),
  habitDefinitions: z.array(habitDefinitionSchema.partial({ id: true })).optional(),
  habitLogs: z.array(habitLogSchema.partial({ id: true })).optional(),
});

export const syncPullQuerySchema = z.object({
  since: z.string().datetime().optional(),
});

export const syncPullResponseSchema = z.object({
  serverTime: z.string(),
  habitDefinitions: z.array(habitDefinitionSchema),
  habitLogs: z.array(habitLogSchema),
});
