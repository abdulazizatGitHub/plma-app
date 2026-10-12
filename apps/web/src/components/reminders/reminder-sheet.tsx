"use client";

import {
  clearCustomReminder,
  dayReminderOf,
  describeDays,
  describeReminder,
  effectiveReminderOn,
  itemTime,
  normalisePrayerKey,
  prayerKeyOf,
  saveCustomReminder,
  setDayReminder,
  type DayEntry,
  type DayReminder,
  type Occurrence,
} from "@life/shared";
import { Bell, BellOff, RotateCcw, Zap } from "lucide-react";
import { useState } from "react";
import { Button, ChipChoice, Sheet, TimeWheel, label12 } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { useStore } from "@/components/providers/store-provider";
import { formatTime } from "@/lib/v2/category-style";
import { shortDate } from "@/lib/v2/dates";
import { quickPicks, soonClock, type QuickPick } from "@/lib/v2/quick-picks";
import { useActions, useAllCategories, useItemReminders, usePrayerSet, usePrayerTimes, useUserSettings } from "@/lib/v2/use-day";
import { useNow } from "@/lib/v2/use-now";
import { DaysPicker, draftDays, repeatSummary, type DaysMode } from "./reminder-section";
import { RepeatFields, repeatDraft, repeatValues, type RepeatDraft } from "./repeat-fields";

const NAMES: Record<string, string> = { fajr: "Fajr", dhuhr: "Zuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };

/**
 * "Remind me…" (owner, 2026-10-13: least effort). One tap on a quick pick sets
 * a reminder for that day and closes, with Undo. Or flick the time wheels,
 * choose Once or repeat days, and Save. No typing anywhere.
 */
export function ReminderSheet({ entry, date, today, onClose }: { entry: DayEntry | null; date: string; today: string; onClose: () => void }) {
  return (
    <Sheet open={entry !== null} onClose={onClose} title={entry ? `Remind me · ${entry.item.title}` : "Remind me"}>
      {entry ? <ReminderSheetBody key={`${entry.key}|${date}`} entry={entry} date={date} today={today} onClose={onClose} /> : null}
    </Sheet>
  );
}

type RepeatChoice = "once" | DaysMode;

/** "every day", "weekdays", "Mon, Wed, Fri". */
function repeatLabel(r: RepeatChoice, days: number[]): string {
  if (r === "every") return "every day";
  if (r === "weekdays" || r === "weekends") return r;
  return describeDays([...days].sort((a, b) => a - b)) || "picked days";
}

const clockOf = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function ReminderSheetBody({ entry, date, today, onClose }: { entry: DayEntry; date: string; today: string; onClose: () => void }) {
  const settings = useUserSettings();
  const run = useActions();
  const { store } = useStore();
  const { notify } = useAddSheet();
  const now = useNow();
  const times = usePrayerTimes(date);
  const rows = useItemReminders(entry.item.id);
  const category = useAllCategories().find((c) => c.id === entry.item.categoryId) ?? null;
  const { prayers } = usePrayerSet();
  const profile = settings.reminderProfiles[entry.item.priority];
  const dayRem = dayReminderOf(entry.occurrence);
  const custom = rows[0] && !rows[0].deletedAt ? rows[0] : null;
  const oneOff = entry.item.schedule.kind === "once";
  const when = date === today ? "today" : shortDate(date);

  const prayerName = (key: string) => {
    const p = prayers.find((x) => normalisePrayerKey(prayerKeyOf(x) ?? "") === key);
    return p?.title ?? NAMES[key] ?? key;
  };
  const picks = quickPicks({
    now,
    date,
    timezone: settings.timezone,
    checkinTime: settings.checkinTime ?? "20:00",
    itemAt: times ? itemTime(entry.item, date, times, settings) : null,
    times,
    prayerName,
    format: formatTime,
  });

  // Start from what's set: this day's reminder, then the item's own, else ~30 min from now.
  const [time, setTime] = useState(
    () =>
      (dayRem?.enabled && dayRem.trigger.type === "at" && dayRem.trigger.time) ||
      (custom?.enabled && custom.trigger.type === "at" && custom.trigger.time) ||
      soonClock(new Date(), settings.timezone),
  );
  const [repeat, setRepeat] = useState<RepeatChoice>(() => {
    if (dayRem || !custom?.enabled || oneOff) return "once";
    if (!custom.days) return "every";
    const key = custom.days.join();
    return key === "1,2,3,4,5" ? "weekdays" : key === "0,6" ? "weekends" : "pick";
  });
  const [days, setDays] = useState<number[]>(custom?.days ?? [1, 2, 3, 4, 5]);
  const [nag, setNag] = useState<RepeatDraft>(() => {
    const src = dayRem?.enabled ? dayRem : custom?.enabled ? custom : null;
    return src ? repeatDraft(src.repeatEveryMin, src.maxRepeats, src.snoozeMin ?? profile.snoozeMin) : repeatDraft(null, 0, profile.snoozeMin);
  });

  const current = describeReminder(effectiveReminderOn(entry, custom, settings, category), entry.item, settings.checkinTime);
  const past = repeat === "once" && date === today && time <= clockOf(now);
  const pickDaysEmpty = repeat === "pick" && days.length === 0;

  /** The entry as stored right now (another tap may have changed it since the sheet opened). */
  const fresh = (): DayEntry => {
    const o = store?.query("occurrences", `WHERE "item_id" = ? AND "date" = ? AND "slot" = ? AND "deleted_at" IS NULL`, [entry.item.id, date, entry.slot])[0] as unknown as
      | Occurrence
      | undefined;
    return { ...entry, occurrence: o ?? null };
  };
  const setDay = (r: DayReminder | null) => run((ctx) => setDayReminder(fresh(), date, r, ctx));

  const quick = (p: QuickPick) => {
    const before = dayReminderOf(fresh().occurrence);
    void setDay({ enabled: true, trigger: p.trigger, repeatEveryMin: null, maxRepeats: 0, snoozeMin: null });
    notify({ message: `Reminder set · ${p.sub}${date === today ? "" : `, ${when}`}`, action: { label: "Undo", onClick: () => void setDay(before) } });
    onClose();
  };

  const save = () => {
    if (past || pickDaysEmpty) return;
    const v = repeatValues(nag);
    if (repeat === "once") {
      void setDay({ enabled: true, trigger: { type: "at", time }, ...v });
      notify({ message: `Reminder set · ${label12(time)}${date === today ? "" : `, ${when}`}` });
    } else {
      void run((ctx) => saveCustomReminder(entry.item.id, custom, { trigger: { type: "at", time }, ...v, days: draftDays({ daysMode: repeat, days }) }, ctx, () => crypto.randomUUID()));
      // A one-day reminder would hide the new repeating one today.
      if (dayReminderOf(fresh().occurrence)) void setDay(null);
      notify({ message: `Repeating reminder · ${label12(time)}` });
    }
    onClose();
  };

  const silenceDay = () => {
    const before = dayReminderOf(fresh().occurrence);
    void setDay({ enabled: false, trigger: { type: "at", time }, repeatEveryMin: null, maxRepeats: 0, snoozeMin: null });
    notify({ message: `No reminder ${when}`, action: { label: "Undo", onClick: () => void setDay(before) } });
    onClose();
  };

  const useDefault = () => {
    void run((ctx) => clearCustomReminder(rows, ctx));
    if (dayRem) void setDay(null);
    notify({ message: "Back to the priority's reminder" });
    onClose();
  };

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-xl bg-track px-3 py-2 text-[12.5px] text-ink">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" aria-hidden />
        <span>
          {dayRem ? <b className="font-medium">{dayRem.enabled ? `Set for ${when}` : `Silenced ${when}`} · </b> : null}
          {current}
        </span>
      </p>

      {picks.length ? (
        <section aria-label="Quick picks">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-ink">
            <Zap className="h-3.5 w-3.5 text-ink-2" aria-hidden /> One tap
          </h3>
          <ul className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
            {picks.map((p) => (
              <li key={p.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => quick(p)}
                  className="flex min-h-12 flex-col items-start justify-center rounded-xl bg-track px-3 py-1.5 text-left whitespace-nowrap hover:bg-border"
                >
                  <span className="text-[13px] font-medium text-ink">{p.label}</span>
                  <span className="text-[11.5px] text-ink-2">{p.sub}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Pick a time" className="space-y-3">
        <h3 className="text-[12px] font-medium text-ink">Or pick a time</h3>
        {!oneOff ? (
          <>
            <div>
              <div>
                <ChipChoice<RepeatChoice>
                  legend="Repeat"
                  hideLegend
                  options={[
                    { value: "once", label: date === today ? "Once (today)" : `Once (${shortDate(date)})` },
                    { value: "every", label: "Every day" },
                    { value: "weekdays", label: "Weekdays" },
                    { value: "weekends", label: "Weekends" },
                    { value: "pick", label: "Pick days" },
                  ]}
                  value={repeat}
                  onChange={setRepeat}
                />
              </div>
            </div>
            {repeat === "pick" ? <DaysPicker mode="pick" days={days} onChange={(_m, d) => setDays(d)} hidePresets /> : null}
          </>
        ) : null}
        <TimeWheel value={time} onChange={setTime} rows={3} />
        <details className="rounded-xl border border-border px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[13px] text-ink">
            <span className="font-medium">Repeat until done &amp; snooze</span>
            <span className="truncate text-[12px] text-ink-2">{repeatSummary(nag)}</span>
          </summary>
          <div className="pt-3">
            <RepeatFields value={nag} onChange={setNag} />
          </div>
        </details>
      </section>

      {/* Always in reach: the sheet scrolls, this stays at the bottom. */}
      <div className="sticky -bottom-4 -mx-4 space-y-1.5 border-t border-border bg-surface px-4 pt-3 pb-1">
        {past ? (
          <p role="alert" className="text-[12px] text-todo">
            That time has already passed today — pick a later one.
          </p>
        ) : pickDaysEmpty ? (
          <p role="alert" className="text-[12px] text-todo">
            Pick at least one day.
          </p>
        ) : null}
        <Button className="w-full" disabled={past || pickDaysEmpty} onClick={save}>
          {repeat === "once" ? `Remind me ${when} · ${label12(time)}` : `Repeat ${repeatLabel(repeat, days)} · ${label12(time)}`}
        </Button>
        <div className="flex flex-wrap justify-center gap-x-4">
          <button type="button" onClick={silenceDay} className="inline-flex min-h-9 items-center gap-1.5 text-[12.5px] font-medium text-ink-2 hover:text-ink">
            <BellOff className="h-3.5 w-3.5" aria-hidden /> No reminder {when}
          </button>
          {dayRem || custom ? (
            <button type="button" onClick={useDefault} className="inline-flex min-h-9 items-center gap-1.5 text-[12.5px] font-medium text-ink-2 hover:text-ink">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Use priority default
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
