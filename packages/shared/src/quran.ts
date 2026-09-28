import { z } from "zod";

export const quranLogPayloadSchema = z.object({
  completed: z.boolean(),
});
export type QuranLogPayload = z.infer<typeof quranLogPayloadSchema>;

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * True when `date` (YYYY-MM-DD, interpreted as a local calendar date) falls
 * on a Friday. Parses the components manually rather than `new Date(str)`,
 * which treats a bare YYYY-MM-DD string as UTC midnight and can shift the
 * weekday by one day in timezones behind UTC.
 */
export function isFriday(date: string): boolean {
  const match = LOCAL_DATE_RE.exec(date);
  if (!match) {
    throw new Error(`Invalid date "${date}"; expected YYYY-MM-DD`);
  }
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return parsed.getDay() === 5;
}

export function isQuranLogDone(payload: unknown): boolean {
  const result = quranLogPayloadSchema.safeParse(payload);
  return result.success && result.data.completed === true;
}
