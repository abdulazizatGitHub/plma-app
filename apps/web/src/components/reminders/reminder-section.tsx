"use client";

import {
  clearCustomReminder,
  describeReminder,
  effectiveReminder,
  saveCustomReminder,
  type ActionContext,
  type Category,
  type Change,
  type Item,
  type Reminder,
  type Trigger,
  type UserSettings,
} from "@life/shared";
import { Bell } from "lucide-react";
import Link from "next/link";
import { ChipChoice, PillGroup, SegmentedTabs, TimeField } from "@/components/kit";
import { RepeatFields, chipsWith, repeatDraft, repeatErrors, repeatValues, type RepeatDraft } from "./repeat-fields";

/*
 * The item's reminder (REM-01, owner 2026-10-12): Auto follows the priority's
 * window from Settings; Custom replaces it with the item's own time, repeat and
 * snooze; Off silences the item. Only one is ever active.
 */

export type ReminderMode = "auto" | "custom" | "off";
type When = "at" | "before" | "prayer";

export type ReminderEditorState = {
  mode: ReminderMode;
  when: When;
  time: string;
  before: string;
  prayer: string;
  relation: "before" | "after";
  offset: string;
  repeat: RepeatDraft;
  /** Which days it reminds on, like an alarm. */
  daysMode: DaysMode;
  /** The picked days (0 = Sunday) when `daysMode` is "pick". */
  days: number[];
};

export type DaysMode = "every" | "weekdays" | "weekends" | "pick";
const DAYS_MODES = [
  { value: "every", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekends", label: "Weekends" },
  { value: "pick", label: "Pick days" },
] as const;
/** Monday first; values are JS weekdays (0 = Sunday). */
const WEEK = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
] as const;

function daysModeOf(days: number[] | null | undefined): DaysMode {
  const key = days ? [...days].sort((a, b) => a - b).join(",") : "";
  if (!days || days.length === 7) return "every";
  if (key === "1,2,3,4,5") return "weekdays";
  if (key === "0,6") return "weekends";
  return "pick";
}

/** The weekdays the editor describes; null = every day. */
export function draftDays(s: Pick<ReminderEditorState, "daysMode" | "days">): number[] | null {
  if (s.daysMode === "weekdays") return [1, 2, 3, 4, 5];
  if (s.daysMode === "weekends") return [0, 6];
  if (s.daysMode === "pick") return s.days.length && s.days.length < 7 ? [...s.days].sort((a, b) => a - b) : null;
  return null;
}

const MODES = [
  { value: "auto", label: "Default" },
  { value: "custom", label: "Custom" },
  { value: "off", label: "Off" },
] as const;
const WHENS = [
  { value: "at", label: "At a time" },
  { value: "before", label: "Before its time" },
  { value: "prayer", label: "Around a prayer" },
] as const;

export function initialReminderState(rows: Reminder[], settings: Pick<UserSettings, "reminderProfiles">, priority: Item["priority"]): ReminderEditorState {
  const r = rows[0];
  const p = settings.reminderProfiles[priority];
  const base: ReminderEditorState = {
    mode: !r ? "auto" : r.enabled ? "custom" : "off",
    when: "at",
    time: "09:00",
    before: "15",
    prayer: "asr",
    relation: "after",
    offset: "10",
    repeat: r?.enabled ? repeatDraft(r.repeatEveryMin, r.maxRepeats, r.snoozeMin ?? p.snoozeMin) : repeatDraft(p.repeatEveryMin, p.maxRepeats, p.snoozeMin),
    daysMode: daysModeOf(r?.enabled ? r.days : null),
    days: r?.enabled && r.days ? [...r.days] : [1, 2, 3, 4, 5],
  };
  const t = r?.enabled ? r.trigger : null;
  if (t?.type === "at" || t?.type === "time") return { ...base, when: "at", time: t.time };
  if (t?.type === "beforeDue") return { ...base, when: "before", before: String(t.min) };
  if (t?.type === "prayer") return { ...base, when: "prayer", prayer: t.prayer, relation: t.relation === "before" ? "before" : "after", offset: String(Math.abs(t.offsetMin ?? 0)) };
  return base;
}

export function reminderErrors(s: ReminderEditorState): string | null {
  if (s.mode !== "custom") return null;
  if (s.when === "at" && !/^\d{2}:\d{2}$/.test(s.time)) return "Pick a reminder time";
  if (s.when === "before" && (!s.before || Number(s.before) > 10080)) return "Reminder: minutes before must be 0–10080";
  if (s.when === "prayer" && (s.offset === "" || Number(s.offset) > 180)) return "Reminder: prayer offset must be 0–180 minutes";
  if (s.daysMode === "pick" && s.days.length === 0) return "Reminder: pick at least one day";
  const r = repeatErrors(s.repeat);
  const first = r.every ?? r.times ?? r.snooze;
  return first ? `Reminder: ${first}` : null;
}

/** The custom reminder the editor describes (time, repeat, snooze). */
export function customDraft(s: ReminderEditorState) {
  const v = repeatValues(s.repeat);
  return { trigger: trigger(s), repeatEveryMin: v.repeatEveryMin, maxRepeats: v.maxRepeats, snoozeMin: v.snoozeMin, days: draftDays(s) };
}

function trigger(s: ReminderEditorState): Trigger {
  if (s.when === "before") return { type: "beforeDue", min: Number(s.before) };
  if (s.when === "prayer") return { type: "prayer", prayer: s.prayer, relation: s.relation, offsetMin: Number(s.offset) };
  return { type: "at", time: s.time };
}

/** The rows to write for the editor's choice (nothing when it didn't change). */
export function reminderChanges(itemId: string, rows: Reminder[], s: ReminderEditorState, initial: ReminderEditorState, ctx: ActionContext): Change[] {
  if (JSON.stringify(s) === JSON.stringify(initial)) return [];
  if (s.mode === "auto") return clearCustomReminder(rows, ctx);
  const newId = () => crypto.randomUUID();
  if (s.mode === "off") return saveCustomReminder(itemId, rows[0], null, ctx, newId);
  return saveCustomReminder(itemId, rows[0], customDraft(s), ctx, newId);
}

type Props = {
  value: ReminderEditorState;
  onChange: (s: ReminderEditorState) => void;
  /** The item as it would be saved (priority, schedule) — for the preview line. */
  preview: Pick<Item, "priority" | "schedule" | "meta">;
  settings: UserSettings;
  category: Category | null;
  prayerOptions: { key: string; title: string }[];
  /** Heading; null hides it (inside a sheet that has its own title). */
  title?: string | null;
  /** Offer "Repeat on" days (repeating items, not a one-day reminder). */
  showDays?: boolean;
};

/** Days picker shared with the "Remind me…" popup: presets plus Mon–Sun circles. */
export function DaysPicker({
  mode,
  days,
  onChange,
  hidePresets,
}: {
  mode: DaysMode;
  days: number[];
  onChange: (mode: DaysMode, days: number[]) => void;
  /** Only the day circles (the caller shows its own presets). */
  hidePresets?: boolean;
}) {
  return (
    <div className="space-y-2">
      {hidePresets ? null : <PillGroup legend="Repeat on" options={DAYS_MODES} value={mode} onChange={(v) => onChange(v, days)} />}
      {mode === "pick" ? (
        <div role="group" aria-label="Days" className="flex flex-wrap gap-1.5">
          {WEEK.map(([d, name]) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(mode, on ? days.filter((x) => x !== d) : [...days, d])}
                className={`h-10 w-10 rounded-full text-[12px] font-medium ${on ? "bg-primary-strong text-on-primary-strong" : "bg-track text-ink hover:bg-border"}`}
              >
                {name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** "Once · snooze 10 min" / "Every 30 min, up to 6 more · snooze 10 min". */
export function repeatSummary(r: RepeatDraft): string {
  const nag = r.repeat ? `Every ${r.every} min, ${Number(r.times) >= 48 ? "until done" : `up to ${r.times} more`}` : "Once";
  return `${nag} · snooze ${r.snooze} min`;
}

export function ReminderSection({ value: s, onChange, preview, settings, category, prayerOptions, title = "Reminder", showDays = false }: Props) {
  const set = <K extends keyof ReminderEditorState>(k: K, v: ReminderEditorState[K]) => onChange({ ...s, [k]: v });
  const auto = effectiveReminder(preview, null, settings, category);
  const summary =
    s.mode === "auto"
      ? describeReminder(auto, preview, settings.checkinTime)
      : s.mode === "off"
        ? "No reminder for this item, whatever its priority."
        : "Your own reminder — it replaces the priority's for this item.";
  return (
    <section aria-label="Reminder" className={title === null ? "space-y-3" : "card space-y-3 p-3.5"}>
      {title !== null ? (
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <Bell className="h-3.5 w-3.5" aria-hidden /> {title}
        </h2>
      ) : null}
      <SegmentedTabs label="Reminder" options={[...MODES]} value={s.mode} onChange={(v) => set("mode", v)} />
      <p className="text-[12px] text-ink-2" aria-live="polite">
        {summary}
        {s.mode === "auto" ? (
          <>
            {" "}
            <Link href="/settings/notifications" className="font-medium text-primary-strong underline-offset-2 hover:underline">
              Change defaults
            </Link>
          </>
        ) : null}
      </p>
      {s.mode === "custom" ? (
        <div className="space-y-3">
          <PillGroup legend="Remind me" options={WHENS} value={s.when} onChange={(v) => set("when", v)} />
          {s.when === "at" ? (
            <TimeField label="Time" value={s.time} onChange={(time) => time && set("time", time)} />
          ) : s.when === "before" ? (
            <ChipChoice legend="How long before its time" options={chipsWith([5, 10, 15, 30, 60], Number(s.before), (n) => `${n} min`)} value={s.before} onChange={(v) => set("before", v)} />
          ) : (
            <div className="space-y-2.5">
              <ChipChoice legend="Prayer" options={prayerOptions.map((p) => ({ value: p.key, label: p.title }))} value={s.prayer} onChange={(v) => set("prayer", v)} />
              <div className="flex flex-wrap gap-3">
                <ChipChoice
                  legend="Before or after"
                  options={[
                    { value: "before", label: "Before" },
                    { value: "after", label: "After" },
                  ]}
                  value={s.relation}
                  onChange={(v) => set("relation", v)}
                />
                <ChipChoice legend="By" options={chipsWith([0, 5, 10, 15, 30], Number(s.offset), (n) => (n ? `${n} min` : "At it"))} value={s.offset} onChange={(v) => set("offset", v)} />
              </div>
            </div>
          )}
          {showDays ? (
            <>
              <DaysPicker mode={s.daysMode} days={s.days} onChange={(daysMode, days) => onChange({ ...s, daysMode, days })} />
              <p className="text-[11.5px] text-ink-2">Only on days the item is due — a monthly item reminds on its day of the month.</p>
            </>
          ) : null}
          <details className="group rounded-xl border border-border px-3 py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[13px] text-ink">
              <span className="font-medium">Repeat &amp; snooze</span>
              <span className="truncate text-[12px] text-ink-2">{repeatSummary(s.repeat)}</span>
            </summary>
            <div className="pt-3">
              <RepeatFields value={s.repeat} onChange={(repeat) => set("repeat", repeat)} />
            </div>
          </details>
        </div>
      ) : null}
    </section>
  );
}
