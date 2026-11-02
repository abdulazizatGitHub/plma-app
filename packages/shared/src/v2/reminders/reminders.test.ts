import { describe, expect, it } from "vitest";
import {
  DEFAULT_REMINDER_PROFILES,
  afterQuiet,
  clearCustomReminder,
  defaultUserSettings,
  describeReminder,
  effectiveReminder,
  occurrenceIdFor,
  plannedFires,
  prayerTimes,
  saveCustomReminder,
  setDayReminder,
  describeDays,
  buildDay,
  type ActionContext,
  type Category,
  type Item,
  type Occurrence,
  type Reminder,
  type ReminderInput,
  type UserSettings,
} from "../index.js";

const U = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
const NOW = "2026-10-01T08:00:00.000Z";
const ctx: ActionContext = { userId: U, now: NOW, deviceId: null };
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const TZ = "Asia/Karachi"; // UTC+5, no DST

function item(over: Partial<Item> = {}): Item {
  return {
    id: uid(), userId: U, createdAt: NOW, updatedAt: NOW, deletedAt: null, categoryId: null, parentId: null, type: "habit", title: "Item", notes: null,
    priority: "medium", isOptional: false, tracking: { v: 1, kind: "check" }, schedule: { v: 1, kind: "daily" }, meta: {}, groupGoalId: null, sortOrder: 0,
    archivedAt: null, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null, ...over,
  };
}
const settings = (over: Partial<UserSettings> = {}): UserSettings => ({ ...defaultUserSettings(U, NOW, TZ), ...over });
const input = (items: Item[], over: Partial<ReminderInput> = {}): ReminderInput => ({ items, occurrences: [], reminders: [], categories: [], settings: settings(), ...over });
/** Karachi wall clock on 12 Oct 2026 → instant. */
const pk = (hhmm: string, day = 12) => new Date(`2026-10-${day}T${hhmm}:00+05:00`);
const day = (d = 12) => [pk("00:00", d), pk("23:59", d)] as const;
const clocks = (fires: { at: Date }[]) => fires.map((f) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(f.at));

describe("effectiveReminder", () => {
  it("follows the priority's window: low none, medium once, high a follow-up, critical repeats", () => {
    const s = settings();
    expect(effectiveReminder({ priority: "low" }, null, s)).toEqual({ source: "off", reason: "priority-off" });
    expect(effectiveReminder({ priority: "medium" }, null, s)).toMatchObject({ source: "auto", repeatEveryMin: null, maxRepeats: 0 });
    expect(effectiveReminder({ priority: "high" }, null, s)).toMatchObject({ source: "auto", repeatEveryMin: 30, maxRepeats: 1 });
    expect(effectiveReminder({ priority: "critical" }, null, s)).toMatchObject({ source: "auto", repeatEveryMin: 30, maxRepeats: 6, snoozeMin: 10 });
  });

  it("a custom reminder replaces auto, with its own repeat and snooze", () => {
    const it1 = item({ priority: "critical" });
    const [c] = saveCustomReminder(it1.id, null, { trigger: { type: "at", time: "07:00" }, repeatEveryMin: 15, maxRepeats: 2, snoozeMin: 5 }, ctx, uid);
    const r = c.row as Reminder;
    expect(effectiveReminder(it1, r, settings())).toMatchObject({ source: "custom", repeatEveryMin: 15, maxRepeats: 2, snoozeMin: 5 });
    const [off] = saveCustomReminder(it1.id, r, null, ctx, uid);
    expect(effectiveReminder(it1, off.row as Reminder, settings())).toEqual({ source: "off", reason: "custom-off" });
    const [back] = clearCustomReminder(off.row as Reminder, ctx);
    expect(effectiveReminder(it1, back.row as Reminder, settings())).toMatchObject({ source: "auto", maxRepeats: 6 });
  });

  it("mute and the global switch silence everything", () => {
    expect(effectiveReminder({ priority: "critical" }, null, settings(), { remindersMuted: true })).toEqual({ source: "off", reason: "muted" });
    expect(effectiveReminder({ priority: "critical" }, null, settings({ notificationsEnabled: false }))).toEqual({ source: "off", reason: "disabled" });
  });

  it("describes itself for the editor", () => {
    const walk = item({ priority: "high", schedule: { v: 1, kind: "daily", anchor: { type: "time", time: "07:30" } } });
    expect(describeReminder(effectiveReminder(walk, null, settings()), walk)).toBe("Auto · High: at its time, then every 30 min until done (up to 1 more)");
    const read = item();
    expect(describeReminder(effectiveReminder(read, null, settings()), read)).toBe("Auto · Medium: at 8:00 PM (check-in)");
  });
});

describe("plannedFires", () => {
  it("fires timed items at their time and untimed ones at check-in", () => {
    const walk = item({ title: "Walk", schedule: { v: 1, kind: "daily", anchor: { type: "time", time: "07:30" } } });
    const read = item({ title: "Read" });
    const fires = plannedFires(input([walk, read]), ...day());
    expect(fires.map((f) => f.title)).toEqual(["Walk", "Read"]);
    expect(clocks(fires)).toEqual(["07:30", "20:00"]);
    expect(fires[0].body).toBe("Due 7:30 AM");
  });

  it("critical repeats until done; done stops everything", async () => {
    const pay = item({ title: "Pay rent", priority: "critical", type: "task", schedule: { v: 1, kind: "once", date: "2026-10-12", time: "10:00" } });
    expect(clocks(plannedFires(input([pay]), ...day()))).toEqual(["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00"]);
    const done: Occurrence = {
      id: await occurrenceIdFor(pay.id, "2026-10-12", ""), userId: U, createdAt: NOW, updatedAt: NOW, deletedAt: null, itemId: pay.id, date: "2026-10-12", slot: "",
      status: "done", value: null, detail: {}, movedTo: null, movedFrom: null, startedAt: null, completedAt: NOW, deviceId: null,
    };
    expect(plannedFires(input([pay], { occurrences: [done] }), ...day())).toEqual([]);
  });

  it("profile edits apply to every auto item", () => {
    const a = item({ priority: "high", type: "task", schedule: { v: 1, kind: "once", date: "2026-10-12", time: "09:00" } });
    const profiles = { ...DEFAULT_REMINDER_PROFILES, high: { enabled: true, leadMin: 15, repeatEveryMin: 10, maxRepeats: 2, snoozeMin: 20 } };
    const fires = plannedFires(input([a], { settings: settings({ reminderProfiles: profiles }) }), ...day());
    expect(clocks(fires)).toEqual(["08:45", "08:55", "09:05"]);
    expect(fires[0].snoozeMin).toBe(20);
  });

  it("waits for the end of quiet hours (across midnight) and collapses repeats there", () => {
    const late = item({ priority: "critical", type: "task", schedule: { v: 1, kind: "once", date: "2026-10-12", time: "22:30" } });
    const s = settings({ quietFrom: "22:00", quietTo: "07:00" });
    const fires = plannedFires(input([late], { settings: s }), pk("00:00"), pk("12:00", 13));
    expect(clocks(fires)).toEqual(["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00"]);
    expect(afterQuiet(pk("12:00"), s)).toEqual(pk("12:00"));
  });

  it("a muted category's items stay silent", () => {
    const cat = { id: uid(), remindersMuted: true, deletedAt: null } as Category;
    const a = item({ categoryId: cat.id });
    expect(plannedFires(input([a], { categories: [cat] }), ...day())).toEqual([]);
  });

  it("prayer-relative: 10 min after Asr follows the local clock across a DST change", () => {
    const tz = "Europe/London"; // BST ends 25 Oct 2026, 02:00 → 01:00
    const s = settings({ timezone: tz, lat: 51.5074, lng: -0.1278, calcMethod: "mwl", madhab: "shafi" });
    const a = item({ title: "Tasbih" });
    const [c] = saveCustomReminder(a.id, null, { trigger: { type: "prayer", prayer: "asr", relation: "after", offsetMin: 10 }, repeatEveryMin: null, maxRepeats: 0, snoozeMin: null }, ctx, uid);
    const base = input([a], { reminders: [c.row as Reminder], settings: s });
    const fires = plannedFires(base, new Date("2026-10-24T00:00:00Z"), new Date("2026-10-27T00:00:00Z"));
    expect(fires.map((f) => f.date)).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
    for (const f of fires) expect(f.at.getTime()).toBe(prayerTimes(f.date, s).at.asr.getTime() + 10 * 60_000);
    // Asr follows the sun: its instant barely moves, but London's wall clock shows it an hour earlier after the change.
    const wall = fires.map((f) => {
      const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(f.at).split(":").map(Number);
      return h * 60 + m;
    });
    expect(wall[0] - wall[1]).toBeGreaterThan(55);
    expect(Math.abs(wall[1] - wall[2])).toBeLessThan(5);
  });

  it("nudges: plan tomorrow and the morning summary when switched on", () => {
    const walk = item({ title: "Walk", schedule: { v: 1, kind: "daily", anchor: { type: "time", time: "07:30" } } });
    const s = settings({ planTomorrowAt: "21:00", morningSummaryAt: "06:30", notificationsEnabled: true, reminderProfiles: { ...DEFAULT_REMINDER_PROFILES, medium: { ...DEFAULT_REMINDER_PROFILES.medium, enabled: false } } });
    const fires = plannedFires(input([walk], { settings: s }), ...day());
    expect(fires.map((f) => [f.title, f.body])).toEqual([
      ["Your day", "1 to do today · first: Walk at 7:30 AM."],
      ["Plan tomorrow", "1 thing on tomorrow so far — add or move anything else."],
    ]);
  });

  it("a today-only reminder replaces the item's usual one for that day only; Off silences just that day", async () => {
    const walk = item({ title: "Walk", priority: "high", schedule: { v: 1, kind: "daily", anchor: { type: "time", time: "07:30" } } });
    const entry = buildDay([walk], [], "2026-10-12")[0];
    const [c] = await setDayReminder(entry, "2026-10-12", { enabled: true, trigger: { type: "at", time: "18:15" }, repeatEveryMin: null, maxRepeats: 0, snoozeMin: 5 }, ctx);
    const occs = [c.row as Occurrence];
    const fires = plannedFires(input([walk], { occurrences: occs }), pk("00:00"), pk("23:59", 13));
    expect(fires.map((f) => `${f.date} ${clocks([f])[0]}`)).toEqual(["2026-10-12 18:15", "2026-10-13 07:30", "2026-10-13 08:00"]);
    expect(fires[0]).toMatchObject({ kind: "custom", snoozeMin: 5 });

    const [off] = await setDayReminder(buildDay([walk], occs, "2026-10-12")[0], "2026-10-12", { enabled: false, trigger: { type: "at", time: "09:00" }, repeatEveryMin: null, maxRepeats: 0, snoozeMin: null }, ctx);
    expect(plannedFires(input([walk], { occurrences: [off.row as Occurrence] }), ...day()).length).toBe(0);
    const [cleared] = await setDayReminder(buildDay([walk], [off.row as Occurrence], "2026-10-12")[0], "2026-10-12", null, ctx);
    expect(clocks(plannedFires(input([walk], { occurrences: [cleared.row as Occurrence] }), ...day()))).toEqual(["07:30", "08:00"]);
  });

  it("repeats on chosen weekdays like an alarm (only on days the item is due)", () => {
    const steps = item({ title: "Steps" });
    const [c] = saveCustomReminder(steps.id, null, { trigger: { type: "at", time: "18:00" }, repeatEveryMin: null, maxRepeats: 0, snoozeMin: null, days: [1, 3, 5] }, ctx, uid);
    const r = c.row as Reminder;
    expect(r.days).toEqual([1, 3, 5]);
    // Mon 12 → Sun 18 Oct 2026: Mon, Wed, Fri only.
    const fires = plannedFires(input([steps], { reminders: [r] }), pk("00:00"), pk("23:59", 18));
    expect(fires.map((f) => f.date)).toEqual(["2026-10-12", "2026-10-14", "2026-10-16"]);
    expect(describeReminder(effectiveReminder(steps, r, settings()), steps)).toBe("Custom: at 6:00 PM · Mon, Wed, Fri");
    const [all] = saveCustomReminder(steps.id, r, { trigger: { type: "at", time: "18:00" }, repeatEveryMin: null, maxRepeats: 0, snoozeMin: null, days: [0, 1, 2, 3, 4, 5, 6] }, ctx, uid);
    expect((all.row as Reminder).days).toBeNull();
    expect([describeDays([1, 2, 3, 4, 5]), describeDays([6, 0]), describeDays(null), describeDays([0, 2])]).toEqual(["Weekdays", "Weekends", "Every day", "Tue, Sun"]);
  });
});

