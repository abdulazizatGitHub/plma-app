import { buildDay, type DayEntry } from "../day.js";
import type { Category, Item, Occurrence, Reminder, UserSettings } from "../entities.js";
import { entryState } from "../progress.js";
import { weekdayOf } from "../schedule.js";
import { prayerKeyOf } from "../prayer/prayer-set.js";
import { clockIn, prayerTimes, zonedInstant, type DayPrayerTimes, type PrayerTimeKey } from "../prayer/times.js";
import { anchorWindow, normalisePrayerKey } from "../prayer/windows.js";
import type { Anchor, Trigger } from "../tracking.js";
import { DEFAULT_REMINDER_PROFILES, dayReminderOf, type ReminderProfiles } from "./model.js";

/*
 * Reminders (REM-01…06, SYSTEM_DESIGN §5.5). Shared so the device can show
 * exactly what the server will send:
 *  - an item reminds per its priority's window (auto), unless it has its own
 *    custom reminder, which replaces it (one active reminder per item);
 *  - repeats stop as soon as the item is done;
 *  - nothing fires in quiet hours (it waits for their end), for a muted
 *    category, or with the global switch off.
 */

const MIN = 60_000;
const TIME_KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

export type EffectiveReminder =
  | { source: "off"; reason: "disabled" | "muted" | "custom-off" | "priority-off" }
  | {
      source: "auto" | "custom";
      /** null = the item's own time (or the check-in time when it has none). */
      trigger: Trigger | null;
      leadMin: number;
      repeatEveryMin: number | null;
      maxRepeats: number;
      snoozeMin: number;
      /** Weekdays it reminds on (0 = Sunday); null = every day the item is due. */
      days?: number[] | null;
    };

export type ReminderSettings = Pick<
  UserSettings,
  | "timezone"
  | "lat"
  | "lng"
  | "calcMethod"
  | "madhab"
  | "prayerOffsets"
  | "prayerManual"
  | "dayParts"
  | "quietFrom"
  | "quietTo"
  | "notificationsEnabled"
  | "reminderProfiles"
  | "checkinTime"
  | "planTomorrowAt"
  | "morningSummaryAt"
>;

const profilesOf = (s: Pick<ReminderSettings, "reminderProfiles">): ReminderProfiles => s.reminderProfiles ?? DEFAULT_REMINDER_PROFILES;

/** Each item's custom reminder: the latest live row (two offline devices may each have made one). */
export function customReminders(reminders: Reminder[]): Map<string, Reminder> {
  const out = new Map<string, Reminder>();
  for (const r of reminders) {
    if (r.deletedAt) continue;
    const had = out.get(r.itemId);
    if (!had || r.updatedAt > had.updatedAt) out.set(r.itemId, r);
  }
  return out;
}

/** The one reminder that applies to an item. */
export function effectiveReminder(
  item: Pick<Item, "priority">,
  custom: Reminder | null | undefined,
  settings: Pick<ReminderSettings, "reminderProfiles" | "notificationsEnabled">,
  category?: Pick<Category, "remindersMuted"> | null,
): EffectiveReminder {
  if (settings.notificationsEnabled === false) return { source: "off", reason: "disabled" };
  if (category?.remindersMuted) return { source: "off", reason: "muted" };
  const profile = profilesOf(settings)[item.priority];
  if (custom && !custom.deletedAt) {
    if (!custom.enabled) return { source: "off", reason: "custom-off" };
    const repeats = custom.repeatEveryMin ? custom.maxRepeats : 0;
    return {
      source: "custom",
      trigger: custom.trigger,
      leadMin: 0,
      repeatEveryMin: repeats ? custom.repeatEveryMin : null,
      maxRepeats: repeats,
      snoozeMin: custom.snoozeMin ?? profile.snoozeMin,
      days: custom.days ?? null,
    };
  }
  if (!profile.enabled) return { source: "off", reason: "priority-off" };
  const repeats = profile.repeatEveryMin ? profile.maxRepeats : 0;
  return { source: "auto", trigger: null, leadMin: profile.leadMin, repeatEveryMin: repeats ? profile.repeatEveryMin : null, maxRepeats: repeats, snoozeMin: profile.snoozeMin };
}

/** The reminder for one day: that day's own reminder ("Remind me…", today only) wins over the item's usual one. */
export function effectiveReminderOn(
  entry: Pick<DayEntry, "item" | "occurrence">,
  custom: Reminder | null | undefined,
  settings: Pick<ReminderSettings, "reminderProfiles" | "notificationsEnabled">,
  category?: Pick<Category, "remindersMuted"> | null,
): EffectiveReminder {
  const usual = effectiveReminder(entry.item, custom, settings, category);
  const day = dayReminderOf(entry.occurrence);
  if (!day || (usual.source === "off" && (usual.reason === "disabled" || usual.reason === "muted"))) return usual;
  if (!day.enabled) return { source: "off", reason: "custom-off" };
  const repeats = day.repeatEveryMin ? day.maxRepeats : 0;
  return {
    source: "custom",
    trigger: day.trigger,
    leadMin: 0,
    repeatEveryMin: repeats ? day.repeatEveryMin : null,
    maxRepeats: repeats,
    snoozeMin: day.snoozeMin ?? profilesOf(settings)[entry.item.priority].snoozeMin,
  };
}

/** When the item itself happens on `date`: its time, its prayer, or its anchor's start. Null = untimed. */
export function itemTime(item: Item, date: string, t: DayPrayerTimes, settings: Pick<ReminderSettings, "dayParts">): Date | null {
  const key = prayerKeyOf(item);
  if (key && TIME_KEYS.includes(normalisePrayerKey(key))) return t.at[normalisePrayerKey(key) as PrayerTimeKey];
  const s = item.schedule;
  if (s.kind === "once") return s.time ? zonedInstant(date, s.time, t.timezone) : null;
  return s.anchor ? anchorStart(s.anchor, t, settings) : null;
}

function anchorStart(anchor: Anchor, t: DayPrayerTimes, settings: Pick<ReminderSettings, "dayParts">, depth = 0): Date | null {
  if (anchor.type === "dayPart") {
    const part = settings.dayParts?.find((p) => p.key === anchor.key);
    return part && depth < 2 ? anchorStart(part.start, t, settings, depth + 1) : null;
  }
  return anchorWindow(anchor, t)?.start ?? null;
}

/** A reminder relative to a prayer: "10 min after Asr" = Asr + 10; "before" counts back from the prayer. */
function prayerRelative(anchor: Extract<Anchor, { type: "prayer" }>, t: DayPrayerTimes): Date | null {
  const key = normalisePrayerKey(anchor.prayer);
  if (!TIME_KEYS.includes(key)) return null;
  const off = Math.abs(anchor.offsetMin ?? 0) * MIN;
  const at = t.at[key as PrayerTimeKey].getTime();
  return new Date(anchor.relation === "before" ? at - off : at + off);
}

/** The first fire of an item's reminder on `date`. */
export function firstFire(item: Item, date: string, eff: Extract<EffectiveReminder, { trigger: unknown }>, t: DayPrayerTimes, settings: ReminderSettings): Date | null {
  const own = itemTime(item, date, t, settings);
  const checkin = zonedInstant(date, settings.checkinTime ?? "20:00", t.timezone);
  const trigger = eff.trigger;
  if (!trigger) return own ? new Date(own.getTime() - eff.leadMin * MIN) : checkin;
  if (trigger.type === "at") return zonedInstant(date, trigger.time, t.timezone);
  if (trigger.type === "beforeDue") return new Date((own ?? checkin).getTime() - trigger.min * MIN);
  if (trigger.type === "prayer") return prayerRelative(trigger, t);
  return anchorStart(trigger, t, settings);
}

/** The calendar date of an instant in a time zone. */
export function localDateIn(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return x.toISOString().slice(0, 10);
}

/** Inside quiet hours → the instant they end; otherwise unchanged. Handles windows across midnight. */
export function afterQuiet(at: Date, settings: Pick<ReminderSettings, "quietFrom" | "quietTo" | "timezone">): Date {
  const { quietFrom: from, quietTo: to, timezone } = settings;
  if (!from || !to || from === to) return at;
  const clock = clockIn(at, timezone);
  const quiet = from < to ? clock >= from && clock < to : clock >= from || clock < to;
  if (!quiet) return at;
  const day = localDateIn(at, timezone);
  let end = zonedInstant(day, to, timezone);
  if (end <= at) end = zonedInstant(addDays(day, 1), to, timezone);
  return end;
}

export type ReminderFire = {
  /** Idempotency key: item|date|slot|attempt, or nudge:kind|date. */
  key: string;
  kind: "auto" | "custom" | "nudge";
  itemId: string | null;
  date: string;
  slot: string;
  at: Date;
  /** 0 = first; 1… = repeats. */
  attempt: number;
  title: string;
  body: string;
  snoozeMin: number;
};

export type ReminderInput = {
  items: Item[];
  occurrences: Occurrence[];
  reminders: Reminder[];
  categories: Category[];
  settings: ReminderSettings;
};

const fmt = (at: Date, tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(at);
const isOpen = (e: DayEntry) => {
  const st = e.occurrence?.status;
  if (st === "skipped" || st === "moved") return false;
  const s = entryState(e);
  return s !== "done" && s !== "not_today";
};

/** Every fire due in [from, to), soonest first. Done, skipped and moved items never fire. */
export function plannedFires(input: ReminderInput, from: Date, to: Date): ReminderFire[] {
  const { items, occurrences, reminders, categories, settings } = input;
  if (settings.notificationsEnabled === false) return [];
  const tz = settings.timezone;
  const custom = customReminders(reminders);
  const cats = new Map(categories.filter((c) => !c.deletedAt).map((c) => [c.id, c]));
  const byId = new Map(items.map((i) => [i.id, i]));
  const categoryOf = (item: Item) => {
    const id = item.categoryId ?? (item.parentId ? byId.get(item.parentId)?.categoryId : null);
    return id ? (cats.get(id) ?? null) : null;
  };

  const fires: ReminderFire[] = [];
  const push = (f: ReminderFire) => {
    const at = afterQuiet(f.at, settings);
    if (at >= from && at < to) fires.push({ ...f, at });
  };
  const first = localDateIn(new Date(from.getTime() - 24 * 60 * MIN), tz);
  const last = localDateIn(to, tz);
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const t = prayerTimes(date, settings);
    const day = buildDay(items, occurrences, date);
    for (const e of day) {
      for (const unit of e.children ?? [e]) {
        if (!isOpen(unit)) continue;
        const eff = effectiveReminderOn(unit, custom.get(unit.item.id), settings, categoryOf(unit.item));
        if (eff.source === "off") continue;
        if (eff.days && !eff.days.includes(weekdayOf(date))) continue;
        const at = firstFire(unit.item, date, eff, t, settings);
        if (!at) continue;
        const context = e.plan ? `${e.plan.title} · ` : e.children ? `${e.item.title} · ` : "";
        const own = itemTime(unit.item, date, t, settings);
        const total = eff.maxRepeats + 1;
        // Each repeat counts from the previous fire, so a run that meets quiet
        // hours resumes after them instead of being lost.
        let fireAt = afterQuiet(at, settings);
        for (let k = 0; k < total; k++) {
          if (k > 0) fireAt = afterQuiet(new Date(fireAt.getTime() + (eff.repeatEveryMin ?? 0) * MIN), settings);
          push({
            key: `${unit.item.id}|${date}|${unit.slot}|${k}`,
            kind: eff.source,
            itemId: unit.item.id,
            date,
            slot: unit.slot,
            at: fireAt,
            attempt: k,
            title: unit.item.title,
            body: k === 0 ? `${context}${own ? `Due ${fmt(own, tz)}` : "Not done yet today"}` : `${context}Still not done · reminder ${k + 1} of ${total}`,
            snoozeMin: eff.snoozeMin,
          });
        }
      }
    }
    nudges(input, date, push);
  }
  return fires.sort((a, b) => a.at.getTime() - b.at.getTime() || a.key.localeCompare(b.key));
}

/** REM-06: the evening "Plan tomorrow" and the morning summary, when switched on. */
function nudges(input: ReminderInput, date: string, push: (f: ReminderFire) => void) {
  const { items, occurrences, settings } = input;
  const units = (d: string) => buildDay(items, occurrences, d).flatMap((e) => e.children ?? [e]).filter((u) => !u.item.isOptional);
  const base = { itemId: null, date, slot: "", attempt: 0, snoozeMin: profilesOf(settings).medium.snoozeMin } as const;
  if (settings.planTomorrowAt) {
    const n = units(addDays(date, 1)).length;
    push({
      ...base,
      key: `nudge:plan|${date}`,
      kind: "nudge",
      at: zonedInstant(date, settings.planTomorrowAt, settings.timezone),
      title: "Plan tomorrow",
      body: n ? `${n} thing${n === 1 ? "" : "s"} on tomorrow so far — add or move anything else.` : "Nothing planned for tomorrow yet.",
    });
  }
  if (settings.morningSummaryAt) {
    const today = units(date).filter(isOpen);
    const t = prayerTimes(date, settings);
    const timed = today
      .map((u) => ({ u, at: itemTime(u.item, date, t, settings) }))
      .filter((x): x is { u: DayEntry; at: Date } => !!x.at)
      .sort((a, b) => a.at.getTime() - b.at.getTime())[0];
    push({
      ...base,
      key: `nudge:morning|${date}`,
      kind: "nudge",
      at: zonedInstant(date, settings.morningSummaryAt, settings.timezone),
      title: "Your day",
      body: today.length
        ? `${today.length} to do today${timed ? ` · first: ${timed.u.item.title} at ${fmt(timed.at, settings.timezone)}` : ""}.`
        : "Nothing due today — enjoy it.",
    });
  }
}

const PRAYER_LABEL: Record<string, string> = { fajr: "Fajr", sunrise: "Sunrise", dhuhr: "Zuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };
const PRIORITY_LABEL = { low: "Low", medium: "Medium", high: "High", critical: "Critical" } as const;

function clock12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "Auto · High: at its time, then every 30 min (up to 1 more)" — for the item editor and tags. */
export function describeReminder(eff: EffectiveReminder, item: Pick<Item, "priority" | "schedule" | "meta">, checkinTime = "20:00"): string {
  if (eff.source === "off") {
    if (eff.reason === "disabled") return "Off — reminders are switched off";
    if (eff.reason === "muted") return "Off — its category is muted";
    if (eff.reason === "custom-off") return "Off for this item";
    return `Off — ${PRIORITY_LABEL[item.priority]} priority has no reminder`;
  }
  const timed = !!prayerKeyOf(item) || (item.schedule.kind === "once" ? !!item.schedule.time : !!item.schedule.anchor);
  let when: string;
  const t = eff.trigger;
  if (!t) when = timed ? (eff.leadMin ? `${eff.leadMin} min before its time` : "at its time") : `at ${clock12(checkinTime)} (check-in)`;
  else if (t.type === "at") when = `at ${clock12(t.time)}`;
  else if (t.type === "beforeDue") when = `${t.min} min before ${timed ? "its time" : "check-in"}`;
  else if (t.type === "prayer") {
    const p = PRAYER_LABEL[normalisePrayerKey(t.prayer)] ?? t.prayer;
    const off = Math.abs(t.offsetMin ?? 0);
    when = off ? `${off} min ${t.relation === "before" ? "before" : "after"} ${p}` : `at ${p}`;
  } else if (t.type === "time") when = `at ${clock12(t.time)}`;
  else when = `at the start of ${t.key}`;
  const repeat = eff.repeatEveryMin && eff.maxRepeats ? `, then every ${eff.repeatEveryMin} min until done (up to ${eff.maxRepeats} more)` : "";
  const head = eff.source === "auto" ? `Auto · ${PRIORITY_LABEL[item.priority]}` : "Custom";
  const days = eff.days ? ` · ${describeDays(eff.days)}` : "";
  return `${head}: ${when}${repeat}${days}`;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Weekdays", "Weekends", "Mon, Wed, Fri" (Monday first); null = every day. */
export function describeDays(days: number[] | null | undefined): string {
  if (!days || days.length === 0 || days.length === 7) return "Every day";
  const key = [...days].sort((a, b) => a - b).join(",");
  if (key === "1,2,3,4,5") return "Weekdays";
  if (key === "0,6") return "Weekends";
  return [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => DAY_SHORT[d]).join(", ");
}
