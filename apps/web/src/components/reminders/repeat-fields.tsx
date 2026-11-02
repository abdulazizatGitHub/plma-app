"use client";

import { ChipChoice } from "@/components/kit";

/*
 * Repeat-until-done and snooze, picked from chips (owner, 2026-10-13: no
 * typing). Per priority in Settings, or per item. Values stay strings in the
 * draft so the shapes saved are unchanged.
 */

export type RepeatDraft = { repeat: boolean; every: string; times: string; snooze: string };

/** "Until done" = the most repeats a reminder may have. */
export const UNTIL_DONE = 48;

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
  if (d.repeat && (!d.times || times < 1 || times > UNTIL_DONE)) out.times = `1 to ${UNTIL_DONE} times`;
  if (!d.snooze || snooze < 1 || snooze > 240) out.snooze = "1 to 240 minutes";
  return out;
}

export const repeatValues = (d: RepeatDraft) => ({
  repeatEveryMin: d.repeat ? Number(d.every) : null,
  maxRepeats: d.repeat ? Number(d.times) : 0,
  snoozeMin: Number(d.snooze),
});

/** The usual chips, plus the current value if it's something else (e.g. 20 min saved earlier). */
export function chipsWith(values: readonly number[], current: number, label: (n: number) => string) {
  const all = values.includes(current) || !Number.isFinite(current) || current <= 0 ? [...values] : [...values, current].sort((a, b) => a - b);
  return all.map((v) => ({ value: String(v), label: label(v) }));
}

const minutes = (n: number) => `${n} min`;

export function RepeatFields({ value, onChange }: { value: RepeatDraft; onChange: (d: RepeatDraft) => void; idPrefix?: string }) {
  const nag = value.repeat ? value.every : "off";
  return (
    <div className="space-y-3">
      <ChipChoice
        legend="Remind again until done"
        options={[{ value: "off", label: "Once" }, ...chipsWith([10, 15, 30, 60], Number(value.every), (n) => `Every ${n} min`)]}
        value={nag}
        onChange={(v) => onChange(v === "off" ? { ...value, repeat: false } : { ...value, repeat: true, every: v })}
      />
      {value.repeat ? (
        <ChipChoice
          legend="Up to"
          options={chipsWith([1, 3, 6, UNTIL_DONE], Number(value.times), (n) => (n === UNTIL_DONE ? "Until done" : `${n} more`))}
          value={value.times}
          onChange={(times) => onChange({ ...value, times })}
        />
      ) : null}
      <ChipChoice legend="Snooze for" options={chipsWith([5, 10, 15, 30], Number(value.snooze), minutes)} value={value.snooze} onChange={(snooze) => onChange({ ...value, snooze })} />
    </div>
  );
}
