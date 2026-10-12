import {
  buildDay,
  categorySchema,
  dayAccess,
  defaultUserSettings,
  entryState,
  itemSchema,
  localDateIn,
  occurrenceSchema,
  plannedFires,
  reminderSchema,
  toggleDone,
  userSettingsSchema,
  type Category,
  type Item,
  type Occurrence,
  type Reminder,
  type ReminderFire,
} from "@life/shared";
import type { Sql } from "postgres";
import { buildUpsert, toDto } from "../sync/sql.js";
import { signAction, type ActionClaims } from "./tokens.js";

/*
 * Server side of reminders (REM-01…06, SYSTEM_DESIGN §5.5). The queue table is
 * the job queue: the planner rewrites a user's upcoming fires from the shared
 * `plannedFires`, and the tick sends the due ones (FOR UPDATE SKIP LOCKED, so
 * several API instances never double-send).
 */

const HOUR = 60 * 60 * 1000;
/** How far ahead fires are queued; the hourly sweep rolls the window forward. */
export const PLAN_AHEAD_MS = 36 * HOUR;
/** A fire this late (server was down) is dropped rather than sent. */
const STALE_MS = 2 * HOUR;

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushResult = "ok" | "gone" | "error";
export type PushSender = (target: PushTarget, payload: string) => Promise<PushResult>;

export type ReminderDeps = { sql: Sql; send: PushSender; actionSecret: string; now?: () => Date };

const rowsOf = async (sql: Sql, text: string, params: unknown[]) =>
  (await sql.unsafe(text, params as never[])).map((r) => toDto(r.r as Record<string, unknown>));

/** Everything the shared planner needs for one user. */
export async function loadUser(sql: Sql, userId: string, from: string, to: string) {
  const [items, occurrences, reminders, categories, settingsRows] = await Promise.all([
    rowsOf(sql, `SELECT row_to_json(t) AS r FROM items t WHERE t.user_id = $1 AND t.deleted_at IS NULL`, [userId]),
    rowsOf(sql, `SELECT row_to_json(t) AS r FROM occurrences t WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.date BETWEEN $2::date AND $3::date`, [userId, from, to]),
    rowsOf(sql, `SELECT row_to_json(t) AS r FROM reminders t WHERE t.user_id = $1 AND t.deleted_at IS NULL`, [userId]),
    rowsOf(sql, `SELECT row_to_json(t) AS r FROM categories t WHERE t.user_id = $1 AND t.deleted_at IS NULL`, [userId]),
    rowsOf(sql, `SELECT row_to_json(t) AS r FROM user_settings t WHERE t.user_id = $1 LIMIT 1`, [userId]),
  ]);
  const fallback = defaultUserSettings(userId, new Date(0).toISOString());
  const parsedSettings = settingsRows[0] ? userSettingsSchema.safeParse(settingsRows[0]) : null;
  // Rows that no longer parse (old shapes) are skipped rather than failing the whole user.
  const keep = <T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, list: unknown[]) =>
    list.map((r) => schema.safeParse(r)).flatMap((p) => (p.success ? [p.data as T] : []));
  return {
    items: keep<Item>(itemSchema, items),
    occurrences: keep<Occurrence>(occurrenceSchema, occurrences),
    reminders: keep<Reminder>(reminderSchema, reminders),
    categories: keep<Category>(categorySchema, categories),
    settings: parsedSettings?.success ? parsedSettings.data : fallback,
  };
}

const dayShift = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 24 * HOUR).toISOString().slice(0, 10);

/** The fires due for a user in the planning window. */
export async function upcomingFires(sql: Sql, userId: string, now: Date): Promise<ReminderFire[]> {
  const [s] = await sql<{ timezone: string }[]>`SELECT timezone FROM user_settings WHERE user_id = ${userId} LIMIT 1`;
  const today = localDateIn(now, s?.timezone ?? "Asia/Karachi");
  const data = await loadUser(sql, userId, dayShift(today, -2), dayShift(today, 3));
  return plannedFires(data, now, new Date(now.getTime() + PLAN_AHEAD_MS));
}

/** A queue key changes with the fire time, so a rescheduled reminder fires again. */
const queueKey = (f: ReminderFire) => `${f.key}@${f.at.toISOString().slice(0, 16)}`;

/** Rewrites a user's upcoming fires (sent and due ones, and snoozes, stay). */
export async function planUser(sql: Sql, userId: string, now = new Date()) {
  const fires = await upcomingFires(sql, userId, now);
  await sql.begin(async (tx) => {
    // Only future fires are rewritten: one that is due but not yet sent stays for the tick
    // (which re-checks the item), so a replan landing just after its time can't lose it.
    await tx`DELETE FROM reminder_queue WHERE user_id = ${userId} AND status = 'pending' AND kind <> 'snooze' AND fire_at > ${now.toISOString()}`;
    for (const f of fires) {
      await tx`
        INSERT INTO reminder_queue (user_id, key, kind, item_id, date, slot, attempt, fire_at, title, body, snooze_min)
        VALUES (${userId}, ${queueKey(f)}, ${f.kind}, ${f.itemId}, ${f.date}, ${f.slot}, ${f.attempt}, ${f.at.toISOString()}, ${f.title}, ${f.body}, ${f.snoozeMin})
        ON CONFLICT (user_id, key) DO NOTHING`;
    }
  });
  return fires.length;
}

/** Replans users whose data changed, a few seconds after their last change (sync pushes come in bursts). */
export function planDebouncer(plan: (userId: string) => Promise<unknown>, delayMs = 3000, onError: (err: unknown) => void = () => {}) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return (userId: string) => {
    clearTimeout(timers.get(userId));
    timers.set(
      userId,
      setTimeout(() => {
        timers.delete(userId);
        plan(userId).catch(onError);
      }, delayMs),
    );
  };
}

/** Hourly: roll every subscribed user's window forward and drop old queue rows. */
export async function replanAll(sql: Sql, now = new Date()) {
  const users = await sql<{ user_id: string }[]>`SELECT DISTINCT user_id FROM push_subscriptions`;
  for (const { user_id } of users) await planUser(sql, user_id, now);
  await sql`DELETE FROM reminder_queue WHERE status <> 'pending' AND fire_at < ${new Date(now.getTime() - 3 * 24 * HOUR).toISOString()}`;
  await sql`DELETE FROM reminder_deliveries WHERE sent_at < ${new Date(now.getTime() - 30 * 24 * HOUR).toISOString()}`;
  return users.length;
}

type QueueRow = {
  id: string;
  user_id: string;
  key: string;
  kind: string;
  item_id: string | null;
  date: string | Date;
  slot: string;
  fire_at: string | Date;
  title: string;
  body: string;
  snooze_min: number;
};

const isoDate = (d: string | Date) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/** Is the item still open for that day (not done, skipped, moved, deleted)? */
async function stillOpen(sql: Sql, row: QueueRow): Promise<boolean> {
  if (!row.item_id) return true;
  const [item] = await sql`SELECT 1 FROM items WHERE id = ${row.item_id} AND deleted_at IS NULL AND archived_at IS NULL`;
  if (!item) return false;
  const [occ] = await sql<{ status: string }[]>`
    SELECT status FROM occurrences
    WHERE item_id = ${row.item_id} AND date = ${isoDate(row.date)} AND slot = ${row.slot} AND deleted_at IS NULL
    LIMIT 1`;
  return !occ || !["done", "skipped", "moved"].includes(occ.status);
}

/** Every minute: send what's due. Returns how many notifications went out. */
export async function tick(deps: ReminderDeps): Promise<number> {
  const { sql } = deps;
  const now = deps.now?.() ?? new Date();
  const due = await sql.begin(async (tx) =>
    tx<QueueRow[]>`
      UPDATE reminder_queue SET status = 'sending'
      WHERE id IN (
        SELECT id FROM reminder_queue
        WHERE status = 'pending' AND fire_at <= ${now.toISOString()}
        ORDER BY fire_at LIMIT 200
        FOR UPDATE SKIP LOCKED)
      RETURNING id, user_id, key, kind, item_id, date, slot, fire_at, title, body, snooze_min`,
  );
  let sent = 0;
  for (const row of due) {
    const late = now.getTime() - new Date(row.fire_at).getTime() > STALE_MS;
    const status = late ? "stale" : (await stillOpen(sql, row)) ? await deliver(deps, row) : "skipped";
    if (status === "sent") sent += 1;
    await sql`UPDATE reminder_queue SET status = ${status} WHERE id = ${row.id}`;
  }
  return sent;
}

async function deliver(deps: ReminderDeps, row: QueueRow): Promise<string> {
  const { sql, send, actionSecret } = deps;
  const subs = await sql<(PushTarget & { id: string })[]>`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${row.user_id}`;
  if (!subs.length) return "no_device";
  const date = isoDate(row.date);
  const baseKey = row.key.replace(/^snooze:/, "").replace(/\|\d+@.*$|@.*$/, "");
  const token = signAction(actionSecret, { u: row.user_id, k: row.key, i: row.item_id, d: date, s: row.slot, z: row.snooze_min });
  const payload = JSON.stringify({
    title: row.title,
    body: row.body,
    // Repeats of the same item and day replace each other instead of stacking.
    tag: baseKey,
    url: "/",
    token: row.item_id ? token : null,
    snoozeMin: row.snooze_min,
  });
  let ok = 0;
  for (const sub of subs) {
    const result = await send(sub, payload);
    if (result === "ok") {
      ok += 1;
      await sql`UPDATE push_subscriptions SET failures = 0, last_success_at = now() WHERE id = ${sub.id}`;
    } else if (result === "gone") await sql`DELETE FROM push_subscriptions WHERE id = ${sub.id}`;
    else await sql`UPDATE push_subscriptions SET failures = failures + 1 WHERE id = ${sub.id}`;
  }
  await sql`INSERT INTO reminder_deliveries (user_id, key, item_id, devices) VALUES (${row.user_id}, ${row.key}, ${row.item_id}, ${ok})`;
  return ok ? "sent" : "failed";
}

/** "Snooze" on a notification: the same fire again after the item's snooze length. */
export async function snooze(sql: Sql, c: ActionClaims, now = new Date()) {
  const [orig] = await sql<{ title: string; body: string; kind: string; attempt: number }[]>`
    SELECT title, body, kind, attempt FROM reminder_queue WHERE user_id = ${c.u} AND key = ${c.k} LIMIT 1`;
  const at = new Date(now.getTime() + Math.max(1, c.z) * 60_000);
  await sql`
    INSERT INTO reminder_queue (user_id, key, kind, item_id, date, slot, attempt, fire_at, title, body, snooze_min)
    VALUES (${c.u}, ${`snooze:${c.k}:${now.getTime()}`}, 'snooze', ${c.i}, ${c.d}, ${c.s}, ${orig?.attempt ?? 0}, ${at.toISOString()},
            ${orig?.title ?? "Reminder"}, ${orig?.body ?? "Snoozed"}, ${c.z})
    ON CONFLICT (user_id, key) DO NOTHING`;
  await sql`INSERT INTO reminder_deliveries (user_id, key, item_id, action) VALUES (${c.u}, ${c.k}, ${c.i}, 'snooze')`;
  return at;
}

/**
 * "Done" on a notification: marks that day's occurrence done, exactly as a tap
 * in the app would (shared `toggleDone`). Never undoes, and never touches a
 * day that has locked.
 */
export async function markDone(sql: Sql, c: ActionClaims, now = new Date()): Promise<"done" | "already" | "locked" | "gone"> {
  if (!c.i) return "gone";
  const data = await loadUser(sql, c.u, c.d, c.d);
  const tz = data.settings.timezone;
  const today = localDateIn(new Date(now.getTime() - (data.settings.dayEndHour ?? 0) * HOUR), tz);
  if (dayAccess(c.d, today) === "history") return "locked";
  const unit = buildDay(data.items, data.occurrences, c.d)
    .flatMap((e) => [e, ...(e.children ?? [])])
    .find((e) => e.item.id === c.i && e.slot === c.s);
  if (!unit) return "gone";
  if (entryState(unit) === "done") return "already";
  const changes = await toggleDone(unit, c.d, { userId: c.u, now: now.toISOString(), deviceId: "push" });
  const rows = changes.map((ch) => ch.row as unknown as Record<string, unknown> & { id: string; userId: string });
  const { text, params } = buildUpsert("occurrences", rows, c.u);
  await sql.unsafe(text, params as never[]);
  await sql`UPDATE reminder_queue SET status = 'skipped' WHERE user_id = ${c.u} AND item_id = ${c.i} AND date = ${c.d} AND status = 'pending'`;
  await sql`INSERT INTO reminder_deliveries (user_id, key, item_id, action) VALUES (${c.u}, ${c.k}, ${c.i}, 'done')`;
  return "done";
}
