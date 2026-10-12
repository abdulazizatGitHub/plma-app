"use client";

import {
  dayReminderOf,
  describeReminder,
  effectiveReminder,
  normalisePrayerKey,
  prayerKeyOf,
  setDayReminder,
  type DayEntry,
  type Reminder,
} from "@life/shared";
import { useState } from "react";
import { Button, SegmentedTabs, Sheet } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { shortDate } from "@/lib/v2/dates";
import { useActions, useAllCategories, useItemReminders, usePrayerSet, useUserSettings } from "@/lib/v2/use-day";
import { ReminderSection, customDraft, initialReminderState, reminderChanges, reminderErrors, type ReminderEditorState } from "./reminder-section";

type Scope = "day" | "everyday";

/** "HH:mm" about 30 min after `hhmm`, rounded up to 5 min (capped at 23:55). */
function soon(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const t = Math.min(23 * 60 + 55, Math.ceil((h * 60 + m + 30) / 5) * 5);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

const FALLBACK_PRAYERS = [
  { key: "fajr", title: "Fajr" },
  { key: "dhuhr", title: "Zuhr" },
  { key: "asr", title: "Asr" },
  { key: "maghrib", title: "Maghrib" },
  { key: "isha", title: "Isha" },
];

/**
 * "Remind me…" from a row's menu (owner, 2026-10-12): the same reminder as in
 * the editor — Auto by priority, Custom (time, repeat, snooze) or Off — set
 * for this day only (default) or as the item's everyday reminder.
 */
export function ReminderSheet({ entry, date, today, onClose }: { entry: DayEntry | null; date: string; today: string; onClose: () => void }) {
  return (
    <Sheet open={entry !== null} onClose={onClose} title={entry ? `Remind me · ${entry.item.title}` : "Remind me"}>
      {entry ? <ReminderSheetBody key={`${entry.key}|${date}`} entry={entry} date={date} today={today} onClose={onClose} /> : null}
    </Sheet>
  );
}

function ReminderSheetBody({ entry, date, today, onClose }: { entry: DayEntry; date: string; today: string; onClose: () => void }) {
  const settings = useUserSettings();
  const run = useActions();
  const { notify } = useAddSheet();
  const rows = useItemReminders(entry.item.id);
  const category = useAllCategories().find((c) => c.id === entry.item.categoryId) ?? null;
  const { prayers } = usePrayerSet();
  const prayerOptions = prayers.length
    ? prayers.flatMap((p) => {
        const key = prayerKeyOf(p);
        return key ? [{ key: normalisePrayerKey(key), title: p.title }] : [];
      })
    : FALLBACK_PRAYERS;

  const day = dayReminderOf(entry.occurrence);
  const [clockNow] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const dayStart: ReminderEditorState = (() => {
    const base = initialReminderState(day ? [{ ...day, deletedAt: null } as unknown as Reminder] : [], settings, entry.item.priority);
    // A new reminder for today starts about half an hour from now (9 AM would already be past in the evening).
    return day ? base : { ...base, mode: "auto", time: date === today ? soon(clockNow) : base.time };
  })();
  const everyStart = initialReminderState(rows, settings, entry.item.priority);
  const [scope, setScope] = useState<Scope>("day");
  const [dayState, setDayState] = useState(dayStart);
  const [everyState, setEveryState] = useState(everyStart);
  const state = scope === "day" ? dayState : everyState;
  const pastToday = scope === "day" && date === today && dayState.mode === "custom" && dayState.when === "at" && dayState.time <= clockNow;
  const error = reminderErrors(state) ?? (pastToday ? "That time has already passed today — pick a later one" : null);
  const usual = describeReminder(effectiveReminder(entry.item, rows[0], settings, category), entry.item, settings.checkinTime);
  const when = date === today ? "today" : shortDate(date);

  const save = () => {
    if (error) return;
    if (scope === "day") {
      const s = dayState;
      void run((ctx) =>
        setDayReminder(entry, date, s.mode === "auto" ? null : s.mode === "off" ? { ...customDraft(s), enabled: false } : { ...customDraft(s), enabled: true }, ctx),
      );
      notify({ message: s.mode === "auto" ? `Usual reminder ${when}` : s.mode === "off" ? `No reminder ${when}` : `Reminder set for ${when}` });
    } else {
      void run((ctx) => reminderChanges(entry.item.id, rows, everyState, everyStart, ctx));
      notify({ message: everyState.mode === "auto" ? "Back to the priority's reminder" : "Everyday reminder saved" });
    }
    onClose();
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <SegmentedTabs<Scope>
        label="Applies to"
        value={scope}
        onChange={setScope}
        options={[
          { value: "day", label: date === today ? "Today only" : `${shortDate(date)} only` },
          { value: "everyday", label: entry.item.schedule.kind === "once" ? "This task" : "Every day" },
        ]}
      />
      {scope === "day" ? (
        <ReminderSection
          title={null}
          value={dayState}
          onChange={setDayState}
          preview={entry.item}
          settings={settings}
          category={category}
          prayerOptions={prayerOptions}
          autoLabel="Usual"
          autoSummary={`Usual: ${usual}`}
        />
      ) : (
        <ReminderSection title={null} value={everyState} onChange={setEveryState} preview={entry.item} settings={settings} category={category} prayerOptions={prayerOptions} />
      )}
      {error ? (
        <p role="alert" className="text-[12px] text-todo">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" className="flex-[2]" disabled={!!error}>
          Save
        </Button>
      </div>
    </form>
  );
}
