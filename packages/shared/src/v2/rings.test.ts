import { describe, expect, it } from "vitest";
import { buildDay, createPrayerSet, dayRings, prayerKeyOf, ringPct, type Item, type Occurrence } from "../index.js";

const U = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
const S = { timezone: "Asia/Karachi", dayEndHour: 0 };
const DAY = "2026-10-12";
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const CREATED = "2026-09-01T08:00:00.000Z";
const BODY = uid();
const MIND = uid();
const SPIRIT = uid();

const item = (over: Partial<Item>): Item => ({
  id: uid(), userId: U, createdAt: CREATED, updatedAt: CREATED, deletedAt: null, categoryId: null, parentId: null, type: "habit", title: "Item", notes: null,
  priority: "medium", isOptional: false, tracking: { v: 1, kind: "check" }, schedule: { v: 1, kind: "daily" }, meta: {}, groupGoalId: null, sortOrder: 0,
  archivedAt: null, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null, ...over,
});
const occ = (it: Item, status: Occurrence["status"], detail: Record<string, unknown> | null = null, updatedAt = `${DAY}T12:00:00.000Z`): Occurrence => ({
  id: uid(), userId: U, createdAt: updatedAt, updatedAt, deletedAt: null, itemId: it.id, date: DAY, slot: "", status, value: null, detail,
  movedTo: null, movedFrom: null, startedAt: null, completedAt: status === "done" ? updatedAt : null, deviceId: null,
});

const set = createPrayerSet({ userId: U, now: CREATED, deviceId: null }, uid, { categoryId: SPIRIT }).map((c) => c.row as unknown as Item);
const prayers = set.filter((p) => p.parentId);
const gym = item({ title: "Gym", categoryId: BODY });
const read = item({ title: "Read", categoryId: MIND });
const journal = item({ title: "Journal", categoryId: MIND, isOptional: true });
const walk = item({ title: "Walk", categoryId: BODY, isOptional: true });
const items = [...set, gym, read, journal];
const rings = (occs: Occurrence[], its: Item[] = items, closed = false) => dayRings(buildDay(its, occs, DAY), DAY, closed, S);
const prayed = (keys: string[], detail: Record<string, unknown> | null = null) => prayers.filter((p) => keys.includes(prayerKeyOf(p)!)).map((p) => occ(p, "done", detail));
const ALL = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

describe("the three rings", () => {
  it("prayers aren't commitments; Balance counts areas (the prayer set counts for its own)", () => {
    const r = rings([]);
    expect(r.prayer).toMatchObject({ due: 5, fill: 0, closed: false });
    expect(r.commit).toMatchObject({ due: 2, fill: 0 }); // Gym, Read — not the optional Journal, not prayers
    expect(r.balance).toMatchObject({ due: 3, fill: 0 }); // Body, Mind, Spirit
    expect(r.complete).toBe(false);
  });

  it("qada fills half a segment but still closes the Prayer ring", () => {
    const r = rings([...prayed(["fajr"], { qada: true }), ...prayed(["dhuhr", "asr", "maghrib", "isha"])]);
    expect(r.prayer).toMatchObject({ fill: 4.5, closed: true, segments: ["done", "done", "done", "done", "qada"] });
    expect(ringPct(r.prayer)).toBe(90);
    expect(r.prayersOnTime).toBe(4);
  });

  it("a prayer recovered after its day closed fills the ring but doesn't close it", () => {
    const recovered = prayers.filter((p) => prayerKeyOf(p) === "fajr").map((p) => occ(p, "done", { qada: true, late: true }, "2026-10-20T09:00:00.000Z"));
    const r = rings([...recovered, ...prayed(["dhuhr", "asr", "maghrib", "isha"])], items, true);
    expect(r.prayer).toMatchObject({ fill: 4.5, closed: false });
  });

  it("Balance: an optional item touches its area; an area with only optional items still needs one", () => {
    const r = rings([occ(journal, "done")]);
    expect(r.balance).toMatchObject({ fill: 1 }); // Mind touched by the optional Journal
    expect(r.commit).toMatchObject({ fill: 0 });
    const onlyOptional = rings([occ(gym, "done")], [gym, walk]);
    expect(onlyOptional.balance).toMatchObject({ due: 1, fill: 1, closed: true });
  });

  it("every ring closed = complete; a late fix makes it complete but not perfect", () => {
    const base = [...prayed(ALL), occ(gym, "done"), occ(read, "done")];
    expect(rings(base)).toMatchObject({ complete: true, perfect: true });
    const lateFix = [...prayed(ALL), occ(gym, "done", { late: true }), occ(read, "done")];
    expect(rings(lateFix)).toMatchObject({ complete: true, perfect: false });
  });

  it("free day: no rings apply, nothing to complete", () => {
    const r = rings([], []);
    expect(r).toMatchObject({ prayer: null, commit: null, balance: null, complete: false });
  });

  it("a closed day shows unfinished as missed; started items fill half", () => {
    const started = rings([{ ...occ(read, "in_progress"), completedAt: null }], [gym, read], true);
    expect(started.commit).toMatchObject({ fill: 0.5, segments: ["qada", "missed"] });
  });
});
