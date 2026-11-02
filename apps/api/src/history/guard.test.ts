import { describe, expect, it } from "vitest";
import type { Row } from "../sync/plan.js";
import { judgeOccurrence, type ItemInfo } from "./guard.js";

const USER = { timezone: "Asia/Karachi", dayEndHour: 0, lat: 24.86, lng: 67.01, calcMethod: "karachi", madhab: "hanafi" as const, prayerOffsets: {} };
// Now: Mon 12 Oct 2026, 10:00 in Karachi.
const NOW = new Date("2026-10-12T10:00:00+05:00");
const habit: ItemInfo = { id: "h", repeating: true, prayer: false };
const task: ItemInfo = { id: "t", repeating: false, prayer: false };
const prayer: ItemInfo = { id: "p", repeating: true, prayer: true };

const row = (over: Partial<Row> & { date: string; updatedAt?: string }): Row => ({
  id: "o1",
  userId: "u",
  itemId: "h",
  slot: "",
  status: "done",
  value: null,
  detail: null,
  updatedAt: NOW.toISOString(),
  ...over,
});
const judge = (r: Row, item: ItemInfo = habit, prev: Record<string, unknown> | null = null, now = NOW) => judgeOccurrence(r, prev, item, USER, now);

describe("server day rules", () => {
  it("today: accepted, never late — even if the client claims it is", () => {
    const v = judge(row({ date: "2026-10-12", detail: { late: true } }));
    expect(v).toEqual({ ok: true, row: expect.objectContaining({ detail: null }) });
  });

  it("inside the correction window: accepted and stamped late by the server (client 'late: false' ignored)", () => {
    for (const date of ["2026-10-11", "2026-10-10"]) {
      const v = judge(row({ date, detail: { late: false, target: 1000 } }));
      expect(v).toEqual({ ok: true, row: expect.objectContaining({ detail: { target: 1000, late: true } }) });
    }
  });

  it("after the window: refused (day closed), the stored copy goes back", () => {
    expect(judge(row({ date: "2026-10-09" }))).toEqual({ ok: false, code: "day_closed" });
  });

  it("offline: logged on time, synced days later — accepted and not late", () => {
    const madeOnTime = row({ date: "2026-10-08", updatedAt: "2026-10-08T21:00:00+05:00" });
    expect(judge(madeOnTime)).toEqual({ ok: true, row: expect.objectContaining({ detail: null }) });
  });

  it("a device clock in the future is refused", () => {
    expect(judge(row({ date: "2026-10-12", updatedAt: "2026-10-12T11:00:00+05:00" }))).toEqual({ ok: false, code: "clock_ahead" });
  });

  it("skipping or moving a habit after its day is refused (it would hide a miss); a one-off move is fine", () => {
    expect(judge(row({ date: "2026-10-11", status: "skipped" }))).toEqual({ ok: false, code: "late_skip" });
    expect(judge(row({ date: "2026-10-11", status: "moved" }))).toEqual({ ok: false, code: "late_skip" });
    expect(judge(row({ date: "2026-10-11", status: "skipped" }), habit, { itemId: "h", slot: "", status: "skipped", date: "2026-10-11" })).toMatchObject({ ok: true }); // already skipped on time
    expect(judge(row({ itemId: "t", date: "2026-10-12", status: "todo" }), task)).toMatchObject({ ok: true }); // moved to today
  });

  it("a missed prayer can be recovered as qada after its day closed — nothing else can", () => {
    expect(judge(row({ itemId: "p", date: "2026-10-01", status: "done", detail: { qada: true } }), prayer)).toEqual({
      ok: true,
      row: expect.objectContaining({ detail: { qada: true, late: true } }),
    });
    expect(judge(row({ itemId: "p", date: "2026-10-01", status: "done" }), prayer)).toEqual({ ok: false, code: "day_closed" });
  });

  it("a re-send of the stored row is a no-op, keeping the server's stamps", () => {
    const stored = { itemId: "h", status: "missed", value: null, date: "2026-10-01", slot: "", movedTo: null, deletedAt: null, detail: { closed: true } };
    const v = judge(row({ date: "2026-10-01", status: "missed", movedTo: null, deletedAt: null }), habit, stored);
    expect(v).toEqual({ ok: true, row: expect.objectContaining({ detail: { closed: true } }) });
  });

  it("future days can be planned but not logged", () => {
    expect(judge(row({ date: "2026-10-15", status: "skipped" }))).toMatchObject({ ok: true });
    expect(judge(row({ date: "2026-10-15", status: "done" }))).toEqual({ ok: false, code: "day_not_started" });
    expect(judge(row({ date: "2026-10-15", status: "in_progress", value: 500 }))).toEqual({ ok: false, code: "day_not_started" });
  });

  it("respects the user's day-end: 1 AM still belongs to yesterday", () => {
    const owl = { ...USER, dayEndHour: 2 };
    const at1am = new Date("2026-10-13T01:00:00+05:00");
    const v = judgeOccurrence(row({ date: "2026-10-12", updatedAt: at1am.toISOString() }), null, habit, owl, at1am);
    expect(v).toEqual({ ok: true, row: expect.objectContaining({ detail: null }) }); // same day, not late
  });

  it("an entry keeps its identity: a closed day's missed row can't be carried to today", () => {
    const missed = { itemId: "h", slot: "", status: "missed", value: null, date: "2026-10-01", movedTo: null, deletedAt: null, detail: { closed: true } };
    expect(judge(row({ date: "2026-10-12", status: "done" }), habit, missed)).toEqual({ ok: false, code: "identity" });
    expect(judge(row({ itemId: "other", date: "2026-10-01", status: "missed" }), habit, missed)).toEqual({ ok: false, code: "identity" });
    expect(judge(row({ date: "2026-10-01", slot: "x", status: "missed" }), habit, missed)).toEqual({ ok: false, code: "identity" });
    // A one-off task really moves: its entry changes day with it.
    const taskRow = { itemId: "t", slot: "", status: "todo", value: null, date: "2026-10-01", movedTo: null, deletedAt: null, detail: null };
    expect(judge(row({ itemId: "t", date: "2026-10-12", status: "todo" }), task, taskRow)).toMatchObject({ ok: true });
  });

  it("Isha and 'after Isha' items logged after midnight but before Fajr are on time, not late", () => {
    const isha: ItemInfo = { id: "i", repeating: true, prayer: true, schedule: { v: 1, kind: "daily" }, meta: { prayerKey: "isha" } };
    const mulk: ItemInfo = { id: "m", repeating: true, prayer: false, schedule: { v: 1, kind: "daily", anchor: { type: "prayer", prayer: "isha", relation: "after", offsetMin: 0 } }, meta: {} };
    const at1am = new Date("2026-10-13T01:00:00+05:00");
    const at6am = new Date("2026-10-13T06:00:00+05:00");
    for (const it of [isha, mulk]) {
      const early = judgeOccurrence(row({ itemId: it.id, date: "2026-10-12", updatedAt: at1am.toISOString() }), null, it, USER, at1am);
      expect(early).toEqual({ ok: true, row: expect.objectContaining({ detail: null }) });
      const after = judgeOccurrence(row({ itemId: it.id, date: "2026-10-12", updatedAt: at6am.toISOString() }), null, it, USER, at6am);
      expect(after).toEqual({ ok: true, row: expect.objectContaining({ detail: { late: true } }) });
    }
  });
});

