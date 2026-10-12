import type { ActionContext, Change } from "../actions.js";
import { reminderSchema, type Reminder } from "../entities.js";
import type { Trigger } from "../tracking.js";

/*
 * Custom reminders (REM-01). One live row per item: saving replaces the
 * item's auto reminder, "Back to auto" removes the row, "Off" keeps a
 * disabled row so the item stays silent whatever its priority.
 */

export type CustomReminderDraft = {
  trigger: Trigger;
  /** Repeat while not done: every N min, up to `maxRepeats` more times. */
  repeatEveryMin: number | null;
  maxRepeats: number;
  /** null = the priority's snooze. */
  snoozeMin: number | null;
};

const rem = (row: Reminder): Change => ({ entity: "reminders", row: reminderSchema.parse(row) });

/** Set (or turn off, with `draft` null) the item's own reminder. */
export function saveCustomReminder(itemId: string, existing: Reminder | null | undefined, draft: CustomReminderDraft | null, ctx: ActionContext, newId: () => string): Change[] {
  const repeats = draft?.repeatEveryMin ? Math.max(0, draft.maxRepeats) : 0;
  const fields = draft
    ? {
        trigger: draft.trigger,
        repeatEveryMin: repeats ? draft.repeatEveryMin : null,
        repeatUntilDone: repeats > 0,
        maxRepeats: repeats,
        snoozeMin: draft.snoozeMin,
        enabled: true,
      }
    : { enabled: false };
  if (existing && !existing.deletedAt) return [rem({ ...existing, ...fields, nextFireAt: null, updatedAt: ctx.now })];
  return [
    rem({
      id: newId(),
      userId: ctx.userId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      deletedAt: null,
      itemId,
      trigger: { type: "at", time: "09:00" },
      repeatEveryMin: null,
      repeatUntilDone: false,
      maxRepeats: 0,
      snoozeMin: null,
      nextFireAt: null,
      ...fields,
    }),
  ];
}

/** "Back to auto": the priority's window applies again. Pass every row the item has (two devices may have made one each). */
export function clearCustomReminder(existing: Reminder[] | Reminder | null | undefined, ctx: ActionContext): Change[] {
  const rows = (Array.isArray(existing) ? existing : existing ? [existing] : []).filter((r) => !r.deletedAt);
  return rows.map((r) => rem({ ...r, deletedAt: ctx.now, updatedAt: ctx.now }));
}
