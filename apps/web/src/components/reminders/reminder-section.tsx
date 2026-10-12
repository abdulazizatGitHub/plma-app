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
import { PillGroup, SegmentedTabs, TextField } from "@/components/kit";
import { sanitizeDigits } from "@/lib/forms/validators";
import { RepeatFields, repeatDraft, repeatErrors, repeatValues, type RepeatDraft } from "./repeat-fields";

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
};

const MODES = [
  { value: "auto", label: "Auto" },
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
  const r = repeatErrors(s.repeat);
  const first = r.every ?? r.times ?? r.snooze;
  return first ? `Reminder: ${first}` : null;
}

/** The custom reminder the editor describes (time, repeat, snooze). */
export function customDraft(s: ReminderEditorState) {
  const v = repeatValues(s.repeat);
  return { trigger: trigger(s), repeatEveryMin: v.repeatEveryMin, maxRepeats: v.maxRepeats, snoozeMin: v.snoozeMin };
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
  const v = repeatValues(s.repeat);
  return saveCustomReminder(itemId, rows[0], { trigger: trigger(s), repeatEveryMin: v.repeatEveryMin, maxRepeats: v.maxRepeats, snoozeMin: v.snoozeMin }, ctx, newId);
}

type Props = {
  value: ReminderEditorState;
  onChange: (s: ReminderEditorState) => void;
  /** The item as it would be saved (priority, schedule) — for the preview line. */
  preview: Pick<Item, "priority" | "schedule" | "meta">;
  settings: UserSettings;
  category: Category | null;
  prayerOptions: { key: string; title: string }[];
  /** For one day ("Remind me…"): Auto reads "Usual" and describes the item's everyday reminder. */
  autoLabel?: string;
  autoSummary?: string;
  /** Heading; null hides it (inside a sheet that has its own title). */
  title?: string | null;
};

export function ReminderSection({ value: s, onChange, preview, settings, category, prayerOptions, autoLabel, autoSummary, title = "Reminder" }: Props) {
  const set = <K extends keyof ReminderEditorState>(k: K, v: ReminderEditorState[K]) => onChange({ ...s, [k]: v });
  const auto = effectiveReminder(preview, null, settings, category);
  const summary =
    s.mode === "auto"
      ? (autoSummary ?? describeReminder(auto, preview, settings.checkinTime))
      : s.mode === "off"
        ? "Off for this item — no reminder whatever its priority."
        : autoLabel
          ? "Custom — replaces the usual reminder for this day only."
          : "Custom — replaces the priority's reminder for this item.";
  return (
    <section aria-label="Reminder" className={title === null ? "space-y-3" : "card space-y-3 p-3.5"}>
      {title !== null ? (
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <Bell className="h-3.5 w-3.5" aria-hidden /> {title}
        </h2>
      ) : null}
      <SegmentedTabs
        label="Reminder"
        options={MODES.map((m) => (m.value === "auto" && autoLabel ? { value: m.value, label: autoLabel } : { ...m }))}
        value={s.mode}
        onChange={(v) => set("mode", v)}
      />
      <p className="text-[12px] text-ink-2" aria-live="polite">
        {summary}
        {s.mode === "auto" && !autoLabel ? (
          <>
            {" "}
            <Link href="/settings/notifications" className="font-medium text-primary-strong underline-offset-2 hover:underline">
              Change priority windows
            </Link>
          </>
        ) : null}
      </p>
      {s.mode === "custom" ? (
        <div className="space-y-3">
          <PillGroup legend="Remind me" options={WHENS} value={s.when} onChange={(v) => set("when", v)} />
          {s.when === "at" ? (
            <TextField label="Time" type="time" value={s.time} onChange={(e) => set("time", e.target.value)} />
          ) : s.when === "before" ? (
            <TextField
              label="Minutes before its time"
              hint="Untimed items count back from your check-in time."
              inputMode="numeric"
              value={s.before}
              onChange={(e) => set("before", sanitizeDigits(e.target.value, 5))}
            />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <TextField label="Minutes" inputMode="numeric" value={s.offset} onChange={(e) => set("offset", sanitizeDigits(e.target.value, 3))} />
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-ink">Before / after</span>
                <select
                  value={s.relation}
                  onChange={(e) => set("relation", e.target.value as "before" | "after")}
                  className="h-10 w-full rounded-[12px] border border-border bg-surface px-2 text-[14px] text-ink outline-none focus:border-primary-strong"
                >
                  <option value="before">before</option>
                  <option value="after">after</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-ink">Prayer</span>
                <select
                  value={s.prayer}
                  onChange={(e) => set("prayer", e.target.value)}
                  className="h-10 w-full rounded-[12px] border border-border bg-surface px-2 text-[14px] text-ink outline-none focus:border-primary-strong"
                >
                  {prayerOptions.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <RepeatFields idPrefix="item-reminder" value={s.repeat} onChange={(repeat) => set("repeat", repeat)} />
        </div>
      ) : null}
    </section>
  );
}
