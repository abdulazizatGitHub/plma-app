import { LOG_GRACE_DAYS, editLag } from "./day-access.js";
import type { DayEntry } from "./day.js";
import type { Occurrence } from "./entities.js";
import { prayerKeyOf } from "./prayer/prayer-set.js";
import { FARD_KEYS, normalisePrayerKey } from "./prayer/windows.js";
import { entryState } from "./progress.js";

/*
 * The three daily rings (Phase 8.1, owner 2026-10-15), like the Health app:
 *  - Prayer: the five fard prayers. On time fills a segment, qada half of one,
 *    and qada still closes the ring. A prayer recovered after its day closed
 *    fills it but can't close it.
 *  - Commitments: required items due that day, prayers excluded.
 *  - Balance: every area (category) with something due gets at least one thing
 *    done, optional items included.
 * A ring with nothing due is null (free). Every ring that applies closed = a
 * complete day (the streak); complete with no late fixes = a perfect day.
 */

export type RingKind = "prayer" | "commit" | "balance";
export type RingSegmentState = "done" | "qada" | "open" | "missed";

export type RingState = {
  due: number;
  /** Done units; qada (and started items) count half. */
  fill: number;
  closed: boolean;
  segments: RingSegmentState[];
};

export type DayRings = {
  prayer: RingState | null;
  commit: RingState | null;
  balance: RingState | null;
  /** Every ring that applies is closed (and at least one applies). */
  complete: boolean;
  /** Complete, with no late fixes. */
  perfect: boolean;
  /** Fard prayers prayed on time (not qada, not late). */
  prayersOnTime: number;
  /** Units done (optional included). */
  itemsDone: number;
};

export type RingSettings = { timezone: string; dayEndHour: number };

export const RING_ORDER: RingKind[] = ["prayer", "commit", "balance"];
export const RING_LABEL: Record<RingKind, string> = { prayer: "Prayer", commit: "Commitments", balance: "Balance" };

const FARD = new Set<string>(FARD_KEYS);
const late = (o: Occurrence | null | undefined) => o?.detail?.late === true;
const qada = (o: Occurrence | null | undefined) => o?.detail?.qada === true;

/** Marked after the day closed (only a prayer recovered as qada can be). */
export function afterClose(o: Occurrence, date: string, s: RingSettings) {
  return late(o) && editLag(date, new Date(o.updatedAt), s.timezone, s.dayEndHour) > LOG_GRACE_DAYS;
}

const ORDER: Record<RingSegmentState, number> = { done: 0, qada: 1, open: 2, missed: 3 };
const sortSegs = (s: RingSegmentState[]) => [...s].sort((a, b) => ORDER[a] - ORDER[b]);

/**
 * The rings for a day's entries (from `buildDay` / `historyDay`). `closed`
 * marks unfinished units as missed rather than open.
 */
export function dayRings(entries: DayEntry[], date: string, closed: boolean, s: RingSettings): DayRings {
  const prayerSegs: RingSegmentState[] = [];
  const commitSegs: RingSegmentState[] = [];
  let pFill = 0;
  let pCounted = 0;
  let cDone = 0;
  let cFill = 0;
  let anyLate = false;
  let prayersOnTime = 0;
  let itemsDone = 0;
  const areas = new Map<string, boolean>();
  const rest: RingSegmentState = closed ? "missed" : "open";

  for (const e of entries) {
    const parentCat = e.item.categoryId ?? e.plan?.categoryId ?? null;
    for (const u of e.children ?? [e]) {
      const state = entryState(u);
      if (state === "not_today") continue;
      const o = u.occurrence;
      const done = state === "done";
      if (done) itemsDone += 1;
      if (done && late(o)) anyLate = true;
      const cat = u.item.categoryId ?? parentCat;
      if (cat) areas.set(cat, (areas.get(cat) ?? false) || done);

      const key = normalisePrayerKey(prayerKeyOf(u.item) ?? "");
      if (u.item.parentId && FARD.has(key)) {
        if (done) {
          const q = qada(o);
          pFill += q ? 0.5 : 1;
          if (o && !afterClose(o, date, s)) pCounted += 1;
          if (!q && !late(o)) prayersOnTime += 1;
          prayerSegs.push(q ? "qada" : "done");
        } else prayerSegs.push(rest);
        continue;
      }
      if (u.item.isOptional) continue;
      if (done) {
        cDone += 1;
        cFill += 1;
        commitSegs.push("done");
      } else if (state === "in_progress") {
        cFill += 0.5;
        commitSegs.push("qada");
      } else commitSegs.push(rest);
    }
  }

  const prayer: RingState | null = prayerSegs.length ? { due: prayerSegs.length, fill: pFill, closed: pCounted === prayerSegs.length, segments: sortSegs(prayerSegs) } : null;
  const commit: RingState | null = commitSegs.length ? { due: commitSegs.length, fill: cFill, closed: cDone === commitSegs.length, segments: sortSegs(commitSegs) } : null;
  const touched = [...areas.values()].filter(Boolean).length;
  const balance: RingState | null = areas.size
    ? { due: areas.size, fill: touched, closed: touched === areas.size, segments: sortSegs([...areas.values()].map((t) => (t ? "done" : rest))) }
    : null;
  const rings = [prayer, commit, balance].filter((r): r is RingState => !!r);
  const complete = rings.length > 0 && rings.every((r) => r.closed);
  return { prayer, commit, balance, complete, perfect: complete && !anyLate, prayersOnTime, itemsDone };
}

/** 0–100 for drawing. */
export const ringPct = (r: RingState | null) => (r && r.due ? Math.min(100, Math.round((r.fill / r.due) * 100)) : 0);
