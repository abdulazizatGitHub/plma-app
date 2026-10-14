import { LOG_GRACE_DAYS, editLag, isLateLog, logicalDateIn, type Item, type OnTimeSettings } from "@life/shared";
import type { Sql } from "postgres";
import type { Row } from "../sync/plan.js";
import { toDto } from "../sync/sql.js";

/*
 * Server-side day rules for occurrences (Phase 7, owner 2026-10-13). The app
 * enforces them too; this is what makes them true for any client:
 *  - an edit is judged by when it was made (updatedAt), so an on-time log
 *    synced days later stays on time; updatedAt may not be in the future
 *  - inside the 2-day correction window: accepted, and stamped `late` by the
 *    server (the client's own value is ignored); repeating items can't be
 *    skipped or moved after their day (that would hide a miss)
 *  - made after the window (the day is closed): only recovering a prayer as qada,
 *    or a no-op re-send; anything else is refused with the server's copy
 *  - future days: plan (skip, move, reminders) but not log
 *  - an entry keeps its identity: its item and slot never change, and only a
 *    one-off task's entry may change day (a move) — otherwise a closed day's
 *    "missed" row could be carried off to today (owner, 2026-10-14)
 *  - "late" means past the item's on-time point: the day's end, or the end of
 *    its own window when that runs past midnight (Isha until Fajr)
 */

const CLOCK_SLACK_MS = 5 * 60_000;

export type Refusal = {
  id: string;
  code: "day_closed" | "late_skip" | "day_not_started" | "clock_ahead" | "identity";
  message: string;
  current: Record<string, unknown> | null;
};

export type ItemInfo = { id: string; repeating: boolean; prayer: boolean; schedule?: Item["schedule"]; meta?: Item["meta"] };
export type UserDay = OnTimeSettings & { closedThrough?: string | null };

const MESSAGES: Record<Refusal["code"], string> = {
  day_closed: "That day is closed — your change wasn't saved.",
  late_skip: "A past day can't be skipped or moved — log it, or leave it missed.",
  day_not_started: "That day hasn't started yet — you can log it on the day.",
  clock_ahead: "This device's clock is ahead — check the date and time.",
  identity: "That entry can't be changed that way — your change wasn't saved.",
};

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

const logs = (r: Row) => r.status === "done" || r.status === "in_progress" || (typeof r.value === "number" && r.value > 0);

/** The same visible state (a re-send, not a change). */
function sameAs(a: Row, b: Record<string, unknown> | null): boolean {
  if (!b) return false;
  const pick = (x: Record<string, unknown>) => JSON.stringify([x.status, x.value ?? null, x.date, x.slot, x.movedTo ?? null, x.deletedAt ?? null, (x.detail as Record<string, unknown> | null)?.qada ?? null]);
  return pick(a) === pick(b);
}

/** Checks a batch of occurrence rows; returns the rows to write (late stamped) and any refusals. */
export async function guardOccurrences(sql: Sql, userId: string, rows: Row[], now = new Date()): Promise<{ accepted: Row[]; refused: Refusal[] }> {
  if (!rows.length) return { accepted: [], refused: [] };
  const [u] = await sql<
    {
      timezone: string | null;
      day_end_hour: number | null;
      lat: number | null;
      lng: number | null;
      calc_method: string | null;
      madhab: string | null;
      prayer_offsets: Record<string, number> | null;
      prayer_manual: Record<string, string> | null;
    }[]
  >`SELECT s.timezone, s.day_end_hour, s.lat, s.lng, s.calc_method, s.madhab, s.prayer_offsets, s.prayer_manual
    FROM users u LEFT JOIN user_settings s ON s.user_id = u.id WHERE u.id = ${userId}`;
  const user: UserDay = {
    timezone: u?.timezone ?? "Asia/Karachi",
    dayEndHour: u?.day_end_hour ?? 0,
    lat: u?.lat ?? null,
    lng: u?.lng ?? null,
    calcMethod: u?.calc_method ?? "karachi",
    madhab: u?.madhab === "shafi" ? "shafi" : "hanafi",
    prayerOffsets: u?.prayer_offsets ?? {},
    prayerManual: u?.prayer_manual ?? {},
  };
  const itemIds = [...new Set(rows.map((r) => r.itemId as string))];
  const itemRows = await sql<{ id: string; schedule: Item["schedule"]; meta: Item["meta"] | null }[]>`
    SELECT id, schedule, meta FROM items WHERE id = ANY(${itemIds}::uuid[]) AND user_id = ${userId}`;
  const items = new Map<string, ItemInfo>(
    itemRows.map((i) => [
      i.id,
      { id: i.id, repeating: i.schedule?.kind !== "once", prayer: typeof i.meta?.prayerKey === "string", schedule: i.schedule, meta: i.meta ?? {} },
    ]),
  );
  const stored = new Map<string, Record<string, unknown>>();
  const existing = await sql.unsafe(`SELECT row_to_json(t) AS r FROM occurrences t WHERE t.id = ANY($1::uuid[]) AND t.user_id = $2`, [rows.map((r) => r.id), userId] as never[]);
  for (const e of existing) {
    const dto = toDto(e.r as Record<string, unknown>);
    stored.set(dto.id as string, dto);
  }

  const accepted: Row[] = [];
  const refused: Refusal[] = [];
  for (const r of rows) {
    const prev = stored.get(r.id) ?? null;
    const verdict = judgeOccurrence(r, prev, items.get(r.itemId as string), user, now);
    if (verdict.ok) accepted.push(verdict.row);
    else refused.push({ id: r.id, code: verdict.code, message: MESSAGES[verdict.code], current: prev });
  }
  return { accepted, refused };
}

export type Verdict = { ok: true; row: Row } | { ok: false; code: Refusal["code"] };

/** The rule for one row (pure, so every case can be tested without a database). */
export function judgeOccurrence(r: Row, prev: Record<string, unknown> | null, item: ItemInfo | undefined, user: UserDay, now: Date): Verdict {
  const today = logicalDateIn(now, user.timezone, user.dayEndHour);
  const date = typeof r.date === "string" ? r.date : "";
  const edited = new Date(String(r.updatedAt));
  if (Number.isNaN(edited.getTime()) || edited.getTime() > now.getTime() + CLOCK_SLACK_MS) return { ok: false, code: "clock_ahead" };
  // An entry keeps its identity: same item and slot; only a one-off task's entry moves days.
  if (prev) {
    if (prev.itemId !== r.itemId || (prev.slot ?? "") !== (r.slot ?? "")) return { ok: false, code: "identity" };
    if ((prev.date ?? null) !== (r.date ?? null) && item?.repeating !== false) return { ok: false, code: "identity" };
  }
  if (!date) return { ok: true, row: r }; // pending (no day)
  // Future days: plan, don't log.
  if (date > addDays(today, 1) && logs(r) && !sameAs(r, prev)) return { ok: false, code: "day_not_started" };
  if (date > today) return { ok: true, row: stamp(r, false) };
  // A re-send of what's stored: keep the stored stamps.
  if (sameAs(r, prev)) return { ok: true, row: prev?.detail && typeof prev.detail === "object" ? { ...r, detail: prev.detail } : r };
  const lag = editLag(date, edited, user.timezone, user.dayEndHour);
  // Made inside the window counts, even if it reaches us after the day closed (offline).
  if (lag <= LOG_GRACE_DAYS) {
    // Skipping or moving a repeating item after its day would hide a miss.
    const hides = lag >= 1 && (r.status === "skipped" || r.status === "moved") && item?.repeating !== false && prev?.status !== r.status;
    if (hides) return { ok: false, code: "late_skip" };
    // Late = past the item's on-time point (Isha and "after Isha" stay on time until Fajr).
    const late = item?.schedule && item.meta ? isLateLog({ schedule: item.schedule, meta: item.meta }, date, edited, user) : lag >= 1;
    return { ok: true, row: stamp(r, late) };
  }
  // Made after the window: only a prayer recovered as qada.
  const qada = item?.prayer === true && r.status === "done" && (r.detail as Record<string, unknown> | null)?.qada === true;
  if (qada) return { ok: true, row: stamp(r, true) };
  return { ok: false, code: "day_closed" };
}

/** The server decides "late"; whatever the client sent is replaced. */
function stamp(r: Row, late: boolean): Row {
  const detail = { ...((r.detail as Record<string, unknown> | null) ?? {}) };
  delete detail.late;
  if (late) detail.late = true;
  return { ...r, detail: Object.keys(detail).length ? detail : null };
}
