import { describe, expect, it } from "vitest";
import {
  buildDay,
  canMarkPrayerOnTime,
  carryOverIsha,
  createPrayerSet,
  defaultUserSettings,
  markPrayer,
  prayerDisplay,
  prayerHeadline,
  prayerTimes,
  prayerTiming,
  type ActionContext,
  type Item,
  type Occurrence,
  type PrayerSettings,
} from "../index.js";

const U = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
const NOW = "2026-10-01T00:00:00.000Z";
const ctx: ActionContext = { userId: U, now: NOW, deviceId: null };
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const KARACHI: PrayerSettings = { ...defaultUserSettings(U, NOW), lat: 24.86, lng: 67.01, timezone: "Asia/Karachi" };
const at = (iso: string) => new Date(`${iso}+05:00`);
const MON = "2026-10-12";
const TUE = "2026-10-13";

const items = createPrayerSet(ctx, uid, { categoryId: null }).map((c) => c.row as Item);
const children = (date: string, occs: Occurrence[] = []) => buildDay(items, occs, date).find((e) => e.children)!.children!;
const byTitle = (date: string, title: string, occs: Occurrence[] = []) => children(date, occs).find((c) => c.item.title === title)!;

describe("prayer timing", () => {
  const mon = prayerTimes(MON, KARACHI);

  it("Isha's time runs until the next Fajr; Asr and Isha have preferred-time notes", () => {
    const isha = prayerTiming("isha", at("2026-10-12T21:00"), mon)!;
    expect(isha).toMatchObject({ state: "now", endsNextDay: true });
    expect(isha.end).toEqual(mon.nextFajr);
    expect(isha.preferredEnd!.getTime()).toBe((mon.at.maghrib.getTime() + mon.nextFajr.getTime()) / 2);
    expect(prayerTiming("asr", at("2026-10-12T21:00"), mon)).toMatchObject({ state: "passed" });
    expect(prayerTiming("asr", at("2026-10-12T21:00"), mon)!.preferredEnd!.getTime()).toBe(mon.at.maghrib.getTime() - 20 * 60_000);
    expect(prayerTiming("fajr", at("2026-10-12T21:00"), mon)!.preferredEnd).toBeNull();
  });

  it("at 9 PM with nothing marked: Isha is now, earlier prayers are unmarked (not qada, not missed), next is tomorrow's Fajr", () => {
    const now = at("2026-10-12T21:00");
    const kids = children(MON);
    expect(kids.map((c) => prayerDisplay(c, MON, MON, now, mon))).toEqual(["unmarked", "unmarked", "unmarked", "unmarked", "now"]);
    const h = prayerHeadline(kids, MON, MON, now, mon);
    expect(h.current?.entry.item.title).toBe("Isha");
    expect(h.current?.timing.end).toEqual(mon.nextFajr);
    expect(h.next).toMatchObject({ key: "fajr", tomorrow: true });
    expect(h.next!.at).toEqual(mon.nextFajr);
    expect(h.unmarked).toBe(4);
  });

  it("mid-afternoon: Asr is upcoming and next today; a marked current prayer isn't 'now'", async () => {
    const now = at("2026-10-12T13:30");
    const zuhr = byTitle(MON, "Zuhr");
    const occs = (await markPrayer(zuhr, MON, "prayed", ctx)).map((c) => c.row as Occurrence);
    const h = prayerHeadline(children(MON, occs), MON, MON, now, mon);
    expect(h.current).toBeNull();
    expect(h.next).toMatchObject({ key: "asr", tomorrow: false });
    expect(prayerDisplay(byTitle(MON, "Asr", occs), MON, MON, now, mon)).toBe("upcoming");
  });

  it("a closed day's unmarked prayer is missed", () => {
    expect(prayerDisplay(byTitle(MON, "Fajr"), MON, TUE, at("2026-10-13T09:00"), mon)).toBe("missed");
  });

  it("after midnight, yesterday's Isha carries over until Fajr and stays markable on time", async () => {
    const twoAm = at("2026-10-13T02:00");
    expect(carryOverIsha(children(MON), MON, TUE, twoAm, mon)?.item.title).toBe("Isha");
    expect(canMarkPrayerOnTime("isha", twoAm, mon)).toBe(true);
    const fiveThirty = at("2026-10-13T05:30");
    expect(carryOverIsha(children(MON), MON, TUE, fiveThirty, mon)).toBeNull();
    expect(canMarkPrayerOnTime("isha", fiveThirty, mon)).toBe(false);
    const occs = (await markPrayer(byTitle(MON, "Isha"), MON, "prayed", ctx)).map((c) => c.row as Occurrence);
    expect(carryOverIsha(children(MON, occs), MON, TUE, twoAm, mon)).toBeNull();
  });
});
