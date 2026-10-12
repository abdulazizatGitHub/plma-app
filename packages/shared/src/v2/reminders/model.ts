import { z } from "zod";

/*
 * Reminder windows per priority (REM-02, owner 2026-10-12). Every item gets
 * the window of its priority unless it has its own custom reminder, which then
 * replaces it: one active reminder per item. Repeat and snooze are the user's
 * to set, here per priority or per item.
 */

export const reminderProfileSchema = z.object({
  enabled: z.boolean(),
  /** Minutes before the item's time (0 = at its time). */
  leadMin: z.number().int().min(0).max(1440),
  /** Repeat while not done: every N minutes… */
  repeatEveryMin: z.number().int().min(5).max(1440).nullable(),
  /** …up to this many more times (0 = no repeat). */
  maxRepeats: z.number().int().min(0).max(48),
  /** "Snooze" on the notification waits this long. */
  snoozeMin: z.number().int().min(1).max(240),
});
export type ReminderProfile = z.infer<typeof reminderProfileSchema>;

export const reminderProfilesSchema = z.object({
  low: reminderProfileSchema,
  medium: reminderProfileSchema,
  high: reminderProfileSchema,
  critical: reminderProfileSchema,
});
export type ReminderProfiles = z.infer<typeof reminderProfilesSchema>;

/** REM-02: low none; medium once; high once + a follow-up after 30 min; critical every 30 min until done, max 6. */
export const DEFAULT_REMINDER_PROFILES: ReminderProfiles = {
  low: { enabled: false, leadMin: 0, repeatEveryMin: null, maxRepeats: 0, snoozeMin: 10 },
  medium: { enabled: true, leadMin: 0, repeatEveryMin: null, maxRepeats: 0, snoozeMin: 10 },
  high: { enabled: true, leadMin: 0, repeatEveryMin: 30, maxRepeats: 1, snoozeMin: 10 },
  critical: { enabled: true, leadMin: 0, repeatEveryMin: 30, maxRepeats: 6, snoozeMin: 10 },
};
