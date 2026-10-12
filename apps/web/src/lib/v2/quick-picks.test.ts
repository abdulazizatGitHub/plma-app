import { defaultUserSettings, prayerTimes } from "@life/shared";
import { describe, expect, it } from "vitest";
import { quickPicks, soonClock } from "./quick-picks";

const TZ = "Asia/Karachi";
const at = (hhmm: string, day = 12) => new Date(`2026-10-${day}T${hhmm}:00+05:00`);
const settings = { ...defaultUserSettings("u", "2026-10-01T00:00:00.000Z", TZ), lat: 24.86, lng: 67.01 };
const times = prayerTimes("2026-10-12", settings);
const base = { date: "2026-10-12", timezone: TZ, checkinTime: "20:00", itemAt: null, times, prayerName: (k: string) => k.toUpperCase(), format: (t: string) => t };
const ids = (now: Date, over = {}) => quickPicks({ ...base, now, ...over }).map((p) => `${p.id} ${p.sub}`);

describe("quick picks", () => {
  it("at 6:10 PM: in 15 / 30 / 60 min, the next prayer and this evening, soonest first", () => {
    const list = ids(at("18:10"));
    expect(list).toContain("in15 18:25");
    expect(list).toContain("in30 18:40");
    expect(list).toContain("in60 19:10");
    expect(list).toContain("evening 20:00");
    expect(list.some((l) => l.startsWith("prayer-isha"))).toBe(true);
  });

  it("at 9 PM 'This evening' is gone; near midnight the relative picks that would cross into tomorrow are hidden", () => {
    expect(ids(at("21:00")).some((l) => l.startsWith("evening"))).toBe(false);
    expect(ids(at("23:40"))).toEqual(["in15 23:55"]);
  });

  it("timed items get 'At its time' and '15 min before it'", () => {
    const list = ids(at("10:00"), { itemAt: at("16:30") });
    expect(list).toContain("before15 16:15");
    expect(list).toContain("itsTime 16:30");
    expect(ids(at("10:00")).some((l) => l.startsWith("itsTime"))).toBe(false);
  });

  it("the wheels start about half an hour ahead, on a 5-minute mark", () => {
    expect(soonClock(at("18:12"), TZ)).toBe("18:45");
    expect(soonClock(at("23:50"), TZ)).toBe("00:20");
  });
});
