import { computeMonthlyPrayerReport, summarizeCounter, type PrayerLogPayload } from "@life/shared";
import { describe, expect, it } from "vitest";
import { mapV1ToV2, stableId, type V1Definition, type V1Log } from "./v1-to-v2.js";

const USER = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
const NOW = "2026-10-09T10:00:00.000Z";
const def = (slug: string, category: string, trackingMethod: string, frequency = "daily", config: Record<string, unknown> = {}, name = slug): V1Definition => ({
  id: stableId(`def:${slug}`),
  slug,
  name,
  category,
  trackingMethod,
  frequency,
  config,
  archivedAt: null,
  deletedAt: null,
});

const definitions = [
  def("prayer", "faith", "prayer_set", "daily", {}, "Daily prayers"),
  def("quran-kahf", "faith", "boolean", "weekly_friday", {}, "Surah Kahf"),
  def("steps", "health", "counter", "daily", { goal: 10000, unit: "steps" }, "Steps"),
  def("water", "health", "counter", "daily", { goal: 8, unit: "glasses" }, "Water"),
  def("exercise", "health", "boolean_duration", "daily", {}, "Exercise"),
  def("sleep", "health", "sleep_window", "daily", { wakeGoal: "06:00" }, "Sleep"),
  def("make-bed", "personal", "boolean", "daily", {}, "Make bed"),
];
const [prayer, kahf, steps, water, exercise, sleep, bed] = definitions;

const prayerDays: Record<string, PrayerLogPayload["prayers"]> = {
  "2026-09-01": { fajr: "missed", zuhr: "completed", asr: "completed", maghrib: "completed", isha: "pending" },
  "2026-09-02": { fajr: "completed", zuhr: "completed", asr: "missed", maghrib: "completed", isha: "completed" },
  "2026-09-03": { fajr: "pending", zuhr: "pending", asr: "pending", maghrib: "pending", isha: "pending" },
};

let n = 0;
const log = (d: V1Definition, logDate: string, payload: Record<string, unknown>, deletedAt: string | null = null): V1Log => ({
  id: stableId(`log:${n++}`),
  habitDefinitionId: d.id,
  logDate,
  payload,
  updatedAt: "2026-09-30T12:00:00.000Z",
  deletedAt,
});

const logs: V1Log[] = [
  ...Object.entries(prayerDays).map(([date, prayers]) => log(prayer, date, { prayers })),
  log(kahf, "2026-09-04", { completed: true }),
  log(steps, "2026-09-01", { value: 12000 }),
  log(steps, "2026-09-02", { value: 4000 }),
  log(steps, "2026-09-03", { value: 0 }),
  log(water, "2026-09-01", { value: 8 }),
  log(exercise, "2026-09-01", { completed: true, durationMinutes: 45, type: "gym" }),
  log(exercise, "2026-09-02", { completed: false }),
  log(sleep, "2026-09-02", { bedAt: "2026-09-01T18:30:00.000Z", wakeAt: "2026-09-02T01:00:00.000Z" }),
  log(bed, "2026-09-01", { completed: true }),
  log(bed, "2026-09-02", { completed: true }, "2026-09-05T00:00:00.000Z"),
];

const out = mapV1ToV2({ userId: USER, now: NOW, definitions, logs });
const itemBySlug = (slug: string) => out.items.find((i) => i.meta.migratedFrom === slug && i.parentId === null)!;
const occFor = (itemId: string) => out.occurrences.filter((o) => o.itemId === itemId);

describe("v1 → v2 migration", () => {
  it("creates one category per old category with v2 names", () => {
    expect(out.categories.map((c) => c.name)).toEqual(["Spiritual", "Physical", "Personal"]);
  });

  it("turns prayer into a group with five children using adhan keys", () => {
    const group = itemBySlug("prayer");
    expect(group.type).toBe("group");
    const children = out.items.filter((i) => i.parentId === group.id);
    expect(children.map((c) => c.title)).toEqual(["Fajr", "Zuhr", "Asr", "Maghrib", "Isha"]);
    expect(children.map((c) => c.meta.prayerKey)).toEqual(["fajr", "dhuhr", "asr", "maghrib", "isha"]);
  });

  it("keeps the monthly prayer report numbers identical", () => {
    const v1 = computeMonthlyPrayerReport(
      Object.entries(prayerDays).map(([logDate, prayers]) => ({ logDate, payload: { prayers } })),
      "2026-09",
    );
    const children = new Set(out.items.filter((i) => i.parentId === itemBySlug("prayer").id).map((i) => i.id));
    const prayerOccs = out.occurrences.filter((o) => children.has(o.itemId));
    const done = prayerOccs.filter((o) => o.status === "done").length;
    const missed = prayerOccs.filter((o) => o.status === "missed").length;
    const v1Done = v1.days.reduce((s, d) => s + d.completed, 0);
    const v1Missed = v1.days.reduce((s, d) => s + d.missed, 0);
    expect([done, missed]).toEqual([v1Done, v1Missed]);
    expect([done, missed]).toEqual([7, 2]);
  });

  it("keeps step totals identical and marks partial days in progress", () => {
    const stepsItem = itemBySlug("steps");
    expect(stepsItem.tracking).toEqual({ v: 1, kind: "quantity", unit: "steps", target: 10000, step: 500 });
    const occs = occFor(stepsItem.id);
    const v1 = summarizeCounter(logs, steps.id, ["2026-09-01", "2026-09-02", "2026-09-03"], 10000);
    expect(occs.reduce((s, o) => s + (o.value ?? 0), 0)).toBe(v1.total);
    expect(occs.map((o) => o.status).sort()).toEqual(["done", "in_progress"]);
  });

  it("keeps exercise type and duration, sleep minutes and bed/wake times", () => {
    expect(occFor(itemBySlug("exercise").id)).toMatchObject([{ value: 45, detail: { type: "gym" } }]);
    expect(occFor(itemBySlug("sleep").id)).toMatchObject([{ value: 390, detail: { bedAt: "2026-09-01T18:30:00.000Z" } }]);
    expect(itemBySlug("sleep").meta.wakeGoal).toBe("06:00");
  });

  it("schedules Kahf on Fridays after Zuhr", () => {
    expect(itemBySlug("quran-kahf").schedule).toMatchObject({ kind: "weekdays", weekdays: [5], anchor: { prayer: "dhuhr", relation: "after" } });
  });

  it("skips deleted logs and is idempotent (same ids on a second run)", () => {
    expect(occFor(itemBySlug("make-bed").id)).toHaveLength(1);
    const again = mapV1ToV2({ userId: USER, now: "2027-01-01T00:00:00.000Z", definitions, logs });
    expect(again.occurrences.map((o) => o.id)).toEqual(out.occurrences.map((o) => o.id));
    expect(again.items.map((i) => i.id)).toEqual(out.items.map((i) => i.id));
  });
});
