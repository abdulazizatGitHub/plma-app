import { z } from "zod";
import { clockSchema, localDateSchema } from "./primitives.js";

/** What an item tracks (REQUIREMENTS_V2 TRK-01…04). Versioned so shapes can evolve. */
export const trackingSchema = z.discriminatedUnion("kind", [
  z.object({ v: z.literal(1), kind: z.literal("check") }),
  z.object({
    v: z.literal(1),
    kind: z.literal("quantity"),
    unit: z.string().min(1).max(24),
    target: z.number().positive().optional(),
    /** Amount per − / + tap, e.g. 500 for steps. */
    step: z.number().positive(),
  }),
  z.object({ v: z.literal(1), kind: z.literal("duration"), targetMin: z.number().int().positive().optional() }),
  z.object({ v: z.literal(1), kind: z.literal("checklist"), steps: z.array(z.string().min(1).max(80)).min(1).max(30) }),
]);
export type Tracking = z.infer<typeof trackingSchema>;

/** Prayer keys understood by the prayer-time calculator; custom prayers use their own key. */
export const PRAYER_TIME_KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const;

/** Ties an item to a time, a prayer ("after Zuhr") or a user day part (SCH-03/04). */
export const anchorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("time"), time: clockSchema }),
  z.object({
    type: z.literal("prayer"),
    prayer: z.string().min(1).max(32),
    relation: z.enum(["before", "at", "after"]),
    offsetMin: z.number().int().min(-180).max(180).default(0),
  }),
  z.object({ type: z.literal("dayPart"), key: z.string().min(1).max(32) }),
]);
export type Anchor = z.infer<typeof anchorSchema>;

const repeatBase = {
  v: z.literal(1),
  anchor: anchorSchema.optional(),
  activeFrom: localDateSchema.optional(),
  activeUntil: localDateSchema.optional(),
};

/** When an item happens (SCH-01/02/05). `once` with `date: null` = pending. */
export const scheduleSchema = z.discriminatedUnion("kind", [
  z.object({ v: z.literal(1), kind: z.literal("once"), date: localDateSchema.nullable(), time: clockSchema.optional() }),
  z.object({ ...repeatBase, kind: z.literal("daily") }),
  z.object({ ...repeatBase, kind: z.literal("weekdays"), weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7) }),
  z.object({ ...repeatBase, kind: z.literal("everyNDays"), n: z.number().int().min(2).max(365) }),
  z.object({ ...repeatBase, kind: z.literal("monthly"), monthDay: z.number().int().min(1).max(31) }),
]);
export type Schedule = z.infer<typeof scheduleSchema>;

/** Reminder trigger (REM-01): a time, minutes before due, or relative to a prayer. */
export const triggerSchema = z.union([
  z.object({ type: z.literal("at"), time: clockSchema }),
  z.object({ type: z.literal("beforeDue"), min: z.number().int().min(0).max(10080) }),
  anchorSchema,
]);
export type Trigger = z.infer<typeof triggerSchema>;
