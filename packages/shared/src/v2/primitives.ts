import { z } from "zod";

/** User-local calendar date, `YYYY-MM-DD`. */
export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** UTC instant as an ISO-8601 string. */
export const instantSchema = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Expected an ISO-8601 timestamp");

/** Wall-clock time, `HH:mm` (24h). */
export const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm");

export const idSchema = z.uuid();

/** Columns every synced row carries. `updatedAt` drives last-write-wins. */
export const syncedRowSchema = z.object({
  id: idSchema,
  userId: idSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
  deletedAt: instantSchema.nullable(),
});
