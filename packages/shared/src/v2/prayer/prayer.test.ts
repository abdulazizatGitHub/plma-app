import { describe, expect, it } from "vitest";
import {
  ANYTIME,
  STARTER_PACKS,
  anchorWindow,
  applySelection,
  buildDay,
  createItem,
  createPrayerSet,
  currentPrayer,
  dayParts,
  defaultUserSettings,
  isDueOn,
  markPrayer,
  nextPrayer,
  partOf,
  prayerInsights,
  prayerKeyOf,
  prayerMark,
  prayerTimes,
  savePrayerSet,
  type ActionContext,
  type Change,
  type Item,
  type Occurrence,
  type PrayerSettings,
} from "../index.js";

const U = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
const NOW = "2026-08-01T00:00:00.000Z";
const ctx: ActionContext = { userId: U, now: NOW, deviceId: "dev-1" };
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

const KARACHI: PrayerSettings = { ...defaultUserSettings(U, NOW), lat: 24.86, lng: 67.01, timezone: "Asia/Karachi" };
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function apply(items: Item[], occs: Occurrence[], changes: Change[]) {
  for (const c of changes) {
    const list: { id: string }[] = c.entity === "items" ? items : occs;
    const at = list.findIndex((r) => r.id === c.row.id);
    if (at >= 0) list[at] = c.row;
    else if (c.entity !== "categories") list.push(c.row);
  }
}

describe("prayer times", () => {
  // Reference: api.aladhan.com /v1/timings, method=1 (Karachi), school=1 (Hanafi), fetched 2026-10-11.
  const cases = [
    { name: "Karachi, 9 Oct 2026", date: "2026-10-09", lat: 24.86, lng: 67.01, ref: { fajr: "05:11", sunrise: "06:27", dhuhr: "12:19", asr: "16:33", maghrib: "18:11", isha: "19:27" } },
    { name: "Lahore, 15 Jan 2026", date: "2026-01-15", lat: 31.55, lng: 74.34, ref: { fajr: "05:37", sunrise: "07:03", dhuhr: "12:12", asr: "15:44", maghrib: "17:22", isha: "18:47" } },
  ];
  for (const c of cases) {
    it(`${c.name} matches AlAdhan within 1 minute`, () => {
      const t = prayerTimes(c.date, { ...KARACHI, lat: c.lat, lng: c.lng });
      for (const [key, ref] of Object.entries(c.ref)) {
        expect(Math.abs(minutes(t.clock[key as keyof typeof t.clock]) - minutes(ref)), `${key}: ${t.clock[key as keyof typeof t.clock]} vs ${ref}`).toBeLessThanOrEqual(1);
      }
      expect(t.approximate).toBe(false);
    });
  }

  it("applies per-prayer offsets and manual times; no location → approximate Karachi", () => {
    const base = prayerTimes("2026-10-09", KARACHI);
    const tuned = prayerTimes("2026-10-09", { ...KARACHI, prayerOffsets: { maghrib: 3 }, prayerManual: { isha: "20:30" } });
    expect(minutes(tuned.clock.maghrib) - minutes(base.clock.maghrib)).toBe(3);
    expect(tuned.clock.isha).toBe("20:30");
    const unset = prayerTimes("2026-10-09", { ...KARACHI, lat: null, lng: null });
    expect(unset.approximate).toBe(true);
    expect(unset.clock.dhuhr).toBe(base.clock.dhuhr);
  });

  it("Shafi'i Asr is earlier than Hanafi", () => {
    const hanafi = prayerTimes("2026-10-09", KARACHI);
    const shafi = prayerTimes("2026-10-09", { ...KARACHI, madhab: "shafi" });
    expect(minutes(shafi.clock.asr)).toBeLessThan(minutes(hanafi.clock.asr));
  });
});

describe("windows, anchors and day parts", () => {
  const t = prayerTimes("2026-10-09", KARACHI); // a Friday

  it("Kahf · Fridays · after Zuhr: due only on Fridays, window Zuhr → Asr", () => {
    const kahf = createItem(uid(), {
      type: "habit",
      title: "Surah Al-Kahf",
      categoryId: null,
      priority: "medium",
      isOptional: false,
      notes: null,
      tracking: { v: 1, kind: "check" },
      schedule: { v: 1, kind: "weekdays", weekdays: [5], anchor: { type: "prayer", prayer: "dhuhr", relation: "after", offsetMin: 0 } },
    }, 0, ctx)[0].row as Item;
    expect(["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-16"].filter((d) => isDueOn(kahf, d))).toEqual(["2026-10-09", "2026-10-16"]);
    const s = kahf.schedule;
    const w = s.kind !== "once" && s.anchor ? anchorWindow(s.anchor, t) : null;
    expect(w).toEqual({ start: t.at.dhuhr, end: t.at.asr });
    expect(partOf(buildDay([kahf], [], "2026-10-09")[0], t)).toBe("after_dhuhr");
  });

  it("before, at and offsets", () => {
    const before = anchorWindow({ type: "prayer", prayer: "fajr", relation: "before", offsetMin: 0 }, t)!;
    expect(before.end).toEqual(t.at.fajr);
    const at = anchorWindow({ type: "prayer", prayer: "zuhr", relation: "at", offsetMin: 10 }, t)!; // "zuhr" is accepted
    expect(at.start.getTime()).toBe(t.at.dhuhr.getTime() - 20 * 60_000);
    expect(anchorWindow({ type: "prayer", prayer: "tahajjud", relation: "after", offsetMin: 0 }, t)).toBeNull();
  });

  it("current and next prayer", () => {
    const afterAsr = new Date(t.at.asr.getTime() + 60_000);
    expect(currentPrayer(afterAsr, t)?.key).toBe("asr");
    expect(nextPrayer(afterAsr, t).key).toBe("maghrib");
    const morning = new Date(t.at.sunrise.getTime() + 60 * 60_000);
    expect(currentPrayer(morning, t)).toBeNull();
    expect(nextPrayer(new Date(t.at.isha.getTime() + 60_000), t)).toEqual({ key: "fajr", at: t.nextFajr });
  });

  it("puts timed tasks in their part and the rest under Anytime", () => {
    const task = (time?: string) =>
      buildDay(
        [createItem(uid(), { type: "task", title: "T", categoryId: null, priority: "medium", isOptional: false, notes: null, tracking: { v: 1, kind: "check" }, schedule: time ? { v: 1, kind: "once", date: "2026-10-09", time } : { v: 1, kind: "once", date: "2026-10-09" } }, 0, ctx)[0].row as Item],
        [],
        "2026-10-09",
      )[0];
    expect(dayParts(t).map((p) => p.key)).toEqual(["after_fajr", "morning", "after_dhuhr", "after_asr", "evening", "night"]);
    expect(partOf(task("08:00"), t)).toBe("morning");
    expect(partOf(task("21:00"), t)).toBe("night");
    expect(partOf(task("03:00"), t)).toBe("night");
    expect(partOf(task(), t)).toBe(ANYTIME);
  });
});

describe("marking and insights", () => {
  function prayerSet() {
    const items: Item[] = [];
    apply(items, [], createPrayerSet(ctx, uid, { categoryId: null }));
    const group = items.find((i) => i.meta.prayerSet)!;
    const kid = (key: string) => items.find((i) => prayerKeyOf(i) === key)!;
    return { items, group, kid };
  }

  it("any order: Asr prayed while Fajr unmarked, then Fajr as qada — both count", async () => {
    const { items, group, kid } = prayerSet();
    const occs: Occurrence[] = [];
    const day = "2026-10-09";
    const child = (key: string) => buildDay(items, occs, day)[0].children!.find((c) => c.item.id === kid(key).id)!;
    apply(items, occs, await markPrayer(child("asr"), day, "prayed", ctx));
    expect(prayerMark(child("fajr"), day, day)).toBe("open");
    apply(items, occs, await markPrayer(child("fajr"), day, "qada", ctx));
    expect(prayerMark(child("fajr"), day, day)).toBe("qada");
    const i = prayerInsights(group, items, occs, day, day, day);
    expect(i.totals).toEqual({ due: 2, prayed: 1, qada: 1, missed: 0 });
    // The next day, the unmarked ones are missed.
    expect(prayerMark(child("isha"), day, "2026-10-10")).toBe("missed");
    apply(items, occs, await markPrayer(child("fajr"), day, "clear", ctx));
    expect(prayerMark(child("fajr"), day, day)).toBe("open");
  });

  it("matches hand-calculated totals for a fixture month", () => {
    const { items, group, kid } = prayerSet();
    const occs: Occurrence[] = [];
    const occ = (key: string, date: string, status: Occurrence["status"], qada = false) =>
      occs.push({
        id: uid(),
        userId: U,
        createdAt: NOW,
        updatedAt: NOW,
        deletedAt: null,
        itemId: kid(key).id,
        date,
        slot: "",
        status,
        value: null,
        detail: qada ? { qada: true } : null,
        movedTo: null,
        movedFrom: null,
        startedAt: null,
        completedAt: null,
        deviceId: null,
      });
    for (let d = 1; d <= 30; d++) {
      const date = `2026-09-${String(d).padStart(2, "0")}`;
      if (d <= 20) occ("fajr", date, "done");
      else if (d <= 25) occ("fajr", date, "done", true); // 26–30 left unmarked → missed
      occ("dhuhr", date, "done");
      occ("asr", date, d <= 5 ? "missed" : "done");
      occ("maghrib", date, "done");
      if (d <= 10 || d > 20) occ("isha", date, "done"); // 11–20 unmarked → missed
    }
    const i = prayerInsights(group, items, occs, "2026-09-01", "2026-09-30", "2026-10-01");
    expect(i.totals).toEqual({ due: 150, prayed: 125, qada: 5, missed: 20 });
    const row = (key: string) => i.rows.find((r) => r.key === key)!;
    expect([row("fajr").prayed, row("fajr").qada, row("fajr").missed, row("fajr").rate, row("fajr").onTimeRate]).toEqual([20, 5, 5, 83, 67]);
    expect(row("isha")).toMatchObject({ prayed: 20, missed: 10, rate: 67 });
    expect(i.mostMissed?.key).toBe("isha");
    expect(i.mostConsistent?.key).toBe("dhuhr");
    expect(i.onTimeStreak).toBe(0); // Fajr was missed the last five days
    expect(i.missedList).toHaveLength(20);
    expect(i.missedList[0].date).toBe("2026-09-30");
    expect(i.suggestion).toMatch(/^Isha is your most missed prayer \(10 of 30\)/);
  });

  it("renaming Zuhr → Dhuhr and adding Tahajjud keeps history and flows into insights", async () => {
    const { items, group, kid } = prayerSet();
    const occs: Occurrence[] = [];
    const day = "2026-10-09";
    const zuhrId = kid("dhuhr").id;
    apply(items, occs, await markPrayer(buildDay(items, occs, day)[0].children!.find((c) => c.item.id === zuhrId)!, day, "prayed", ctx));
    const drafts = items
      .filter((i) => i.parentId === group.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => ({ id: i.id, title: i.id === zuhrId ? "Dhuhr" : i.title }));
    apply(items, occs, savePrayerSet(group, items, [{ title: "Tahajjud" }, ...drafts], { ...ctx, now: "2026-10-09T01:00:00.000Z" }, uid));
    const kids = buildDay(items, occs, day)[0].children!;
    expect(kids.map((k) => k.item.title)).toEqual(["Tahajjud", "Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]);
    expect(prayerKeyOf(kids[0].item)).toBe("tahajjud");
    expect(kids[0].item.schedule).toMatchObject({ anchor: { prayer: "fajr", relation: "before" } });
    const i = prayerInsights(group, items, occs, day, day, day);
    expect(i.rows.find((r) => r.itemId === zuhrId)).toMatchObject({ title: "Dhuhr", prayed: 1 });
    expect(i.rows.map((r) => r.title)).toContain("Tahajjud");
  });

  it("setup's Spiritual suggestion builds the prayer block with keys", () => {
    const items: Item[] = [];
    apply(items, [], applySelection([{ packId: STARTER_PACKS[0].id, items: [{ index: 0 }] }], [], ctx, uid));
    const group = items.find((i) => i.meta.prayerSet)!;
    expect(group).toMatchObject({ type: "group", title: "Daily prayers", sourceTemplateId: STARTER_PACKS[0].id });
    expect(items.filter((i) => i.parentId === group.id).map((i) => prayerKeyOf(i))).toEqual(["fajr", "dhuhr", "asr", "maghrib", "isha"]);
  });
});
