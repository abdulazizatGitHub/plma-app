"use client";

import { Checkbox, TextField } from "@/components/kit";
import { sanitizeDigits } from "@/lib/forms/validators";

/*
 * Repeat and snooze, as the user sets them (owner, 2026-10-12): per priority
 * in Settings, or per item on a custom reminder. Strings while editing so
 * fields can be empty; `repeatErrors` says what's wrong before saving.
 */

export type RepeatDraft = { repeat: boolean; every: string; times: string; snooze: string };

export const repeatDraft = (everyMin: number | null, maxRepeats: number, snoozeMin: number): RepeatDraft => ({
  repeat: !!everyMin && maxRepeats > 0,
  every: String(everyMin ?? 30),
  times: String(maxRepeats > 0 ? maxRepeats : 3),
  snooze: String(snoozeMin),
});

export function repeatErrors(d: RepeatDraft): Partial<Record<"every" | "times" | "snooze", string>> {
  const out: Partial<Record<"every" | "times" | "snooze", string>> = {};
  const every = Number(d.every);
  const times = Number(d.times);
  const snooze = Number(d.snooze);
  if (d.repeat && (!d.every || every < 5 || every > 1440)) out.every = "5 to 1440 minutes";
  if (d.repeat && (!d.times || times < 1 || times > 48)) out.times = "1 to 48 times";
  if (!d.snooze || snooze < 1 || snooze > 240) out.snooze = "1 to 240 minutes";
  return out;
}

export const repeatValues = (d: RepeatDraft) => ({
  repeatEveryMin: d.repeat ? Number(d.every) : null,
  maxRepeats: d.repeat ? Number(d.times) : 0,
  snoozeMin: Number(d.snooze),
});

export function RepeatFields({ value, onChange, idPrefix }: { value: RepeatDraft; onChange: (d: RepeatDraft) => void; idPrefix: string }) {
  const errors = repeatErrors(value);
  const num = (key: "every" | "times" | "snooze", max = 4) => ({
    value: value[key],
    inputMode: "numeric" as const,
    onChange: (e: { target: { value: string } }) => onChange({ ...value, [key]: sanitizeDigits(e.target.value, max) }),
    error: errors[key] ?? null,
  });
  return (
    <div className="space-y-2.5">
      <Checkbox checked={value.repeat} onChange={(repeat) => onChange({ ...value, repeat })}>
        Repeat until done
      </Checkbox>
      {value.repeat ? (
        <div className="grid grid-cols-2 gap-2">
          <TextField id={`${idPrefix}-every`} label="Every (minutes)" {...num("every")} />
          <TextField id={`${idPrefix}-times`} label="Up to (more times)" {...num("times", 2)} />
        </div>
      ) : null}
      <TextField id={`${idPrefix}-snooze`} label="Snooze for (minutes)" hint="What “Snooze” on the notification waits." {...num("snooze", 3)} />
    </div>
  );
}
