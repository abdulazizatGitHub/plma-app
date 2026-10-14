import {
  BADGES,
  LOG_GRACE_DAYS,
  badgeProgress,
  itemSchema,
  logicalDateIn,
  occurrenceSchema,
  planProgress,
  rewardsSummary,
  scoreDay,
  type BadgeProgress,
  type Item,
  type Occurrence,
  type RewardDay,
  type RewardSettings,
  type RewardsPayload,
} from "@life/shared";
import type { Sql, TransactionSql } from "postgres";
import { toDto } from "../sync/sql.js";

/*
 * Rewards on the server (Phase 8). Devices only sync entries; every point,
 * streak and badge is worked out here from stored entries, one scored row per
 * day. Re-scoring a day gives the same row, so re-syncs and replays can't add
 * points. Closed days are scored once, when they close, and then stay put —
 * editing an item's priority later doesn't re-price old days.
 */

type Db = Sql | TransactionSql;

/** How far back the first build goes. */
const FIRST_BUILD_DAYS = 365;

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const isoDay = (v: string | Date | null) => (v ? (typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10)) : null);

export type UserScoring = RewardSettings & { weekStart: number; closedThrough: string | null; created: string; builtAt: Date | null; today: string };

export async function userScoring(sql: Db, userId: string, now = new Date()): Promise<UserScoring | null> {
  const [u] = await sql<
    { timezone: string | null; day_end_hour: number | null; week_start: number | null; closed_through: string | Date | null; created_at: Date; rewards_built_at: Date | null }[]
  >`SELECT s.timezone, s.day_end_hour, s.week_start, u.closed_through, u.created_at, u.rewards_built_at
    FROM users u LEFT JOIN user_settings s ON s.user_id = u.id WHERE u.id = ${userId}`;
  if (!u) return null;
  const timezone = u.timezone ?? "Asia/Karachi";
  const dayEndHour = u.day_end_hour ?? 0;
  return {
    timezone,
    dayEndHour,
    weekStart: u.week_start ?? 1,
    closedThrough: isoDay(u.closed_through),
    created: logicalDateIn(new Date(u.created_at), timezone, dayEndHour),
    builtAt: u.rewards_built_at,
    today: logicalDateIn(now, timezone, dayEndHour),
  };
}

async function loadItems(sql: Db, userId: string): Promise<Item[]> {
  return (await sql.unsafe(`SELECT row_to_json(t) AS r FROM items t WHERE t.user_id = $1 AND t.deleted_at IS NULL`, [userId]))
    .map((e) => itemSchema.safeParse(toDto(e.r as Record<string, unknown>)))
    .flatMap((p) => (p.success ? [p.data] : []));
}

async function loadOccurrences(sql: Db, userId: string, from: string, to: string): Promise<Occurrence[]> {
  return (
    await sql.unsafe(`SELECT row_to_json(t) AS r FROM occurrences t WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.date BETWEEN $2::date AND $3::date`, [
      userId,
      from,
      to,
    ])
  )
    .map((e) => occurrenceSchema.safeParse(toDto(e.r as Record<string, unknown>)))
    .flatMap((p) => (p.success ? [p.data] : []));
}

/** Scores every day in [from, to] and stores the rows. */
export async function scoreRange(sql: Db, userId: string, from: string, to: string, u: Pick<UserScoring, "timezone" | "dayEndHour" | "closedThrough">) {
  if (from > to) return 0;
  const items = await loadItems(sql, userId);
  const occs = await loadOccurrences(sql, userId, from, to);
  const byDate = new Map<string, Occurrence[]>();
  for (const o of occs) if (o.date) byDate.set(o.date, [...(byDate.get(o.date) ?? []), o]);
  const rows: Record<string, unknown>[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const d = scoreDay(items, byDate.get(date) ?? [], date, !!u.closedThrough && date <= u.closedThrough, u);
    rows.push({ user_id: userId, date, due: d.due, done: d.done, complete: d.complete, perfect: d.perfect, all_prayers: d.allPrayers, points: d.points });
  }
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    await sql`
      INSERT INTO reward_days ${sql(chunk, "user_id", "date", "due", "done", "complete", "perfect", "all_prayers", "points")}
      ON CONFLICT (user_id, date) DO UPDATE SET due = EXCLUDED.due, done = EXCLUDED.done, complete = EXCLUDED.complete,
        perfect = EXCLUDED.perfect, all_prayers = EXCLUDED.all_prayers, points = EXCLUDED.points, updated_at = now()`;
  }
  return rows.length;
}

export async function readDays(sql: Db, userId: string): Promise<RewardDay[]> {
  const rows = await sql<{ date: string | Date; due: number; done: number; complete: boolean; perfect: boolean; all_prayers: boolean | null; points: number }[]>`
    SELECT date, due, done, complete, perfect, all_prayers, points FROM reward_days WHERE user_id = ${userId} ORDER BY date`;
  return rows.map((r) => ({ date: isoDay(r.date)!, due: r.due, done: r.done, complete: r.complete, perfect: r.perfect, allPrayers: r.all_prayers, points: r.points }));
}

async function plansFinished(sql: Db, userId: string, items: Item[], today: string): Promise<number> {
  const plans = items.filter((i) => i.type === "plan" && !i.archivedAt);
  if (!plans.length) return 0;
  const steps = items.filter((i) => i.parentId && plans.some((p) => p.id === i.parentId));
  if (!steps.length) return 0;
  const done = (
    await sql.unsafe(`SELECT row_to_json(t) AS r FROM occurrences t WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.status = 'done' AND t.item_id = ANY($2::uuid[])`, [
      userId,
      steps.map((s) => s.id),
    ])
  )
    .map((e) => occurrenceSchema.safeParse(toDto(e.r as Record<string, unknown>)))
    .flatMap((p) => (p.success ? [p.data] : []));
  return plans.filter((p) => planProgress(p, steps, done, today).complete).length;
}

/** Awards every badge the history has earned that isn't stored yet (once each). */
export async function awardBadges(sql: Db, userId: string, u: UserScoring, days?: RewardDay[]): Promise<BadgeProgress[]> {
  const all = days ?? (await readDays(sql, userId));
  const progress = badgeProgress(all, u.closedThrough, { weekStart: u.weekStart, plansFinished: await plansFinished(sql, userId, await loadItems(sql, userId), u.today) });
  const earned = progress.filter((b) => b.earned).map((b) => ({ user_id: userId, badge_id: b.id }));
  if (earned.length) await sql`INSERT INTO user_badges ${sql(earned, "user_id", "badge_id")} ON CONFLICT (user_id, badge_id) DO NOTHING`;
  return progress;
}

/**
 * Brings a user's scores up to date: the first time, past days are scored;
 * after that only the open days (not yet closed) are re-scored.
 */
export async function refreshRewards(sql: Sql, userId: string, now = new Date()): Promise<UserScoring | null> {
  const u = await userScoring(sql, userId, now);
  if (!u) return null;
  const floor = addDays(u.today, -FIRST_BUILD_DAYS);
  if (!u.builtAt) {
    const from = u.created > floor ? u.created : floor;
    await sql.begin(async (tx) => {
      await scoreRange(tx, userId, from, u.today, u);
      await tx`UPDATE users SET rewards_built_at = now() WHERE id = ${userId}`;
    });
  } else {
    const open = u.closedThrough ? addDays(u.closedThrough, 1) : addDays(u.today, -LOG_GRACE_DAYS);
    await scoreRange(sql, userId, open > floor ? open : floor, u.today, u);
  }
  return u;
}

/** GET /v1/rewards: refresh, award, summarise. */
export async function getRewards(sql: Sql, userId: string, now = new Date()): Promise<RewardsPayload | null> {
  const u = await refreshRewards(sql, userId, now);
  if (!u) return null;
  const days = await readDays(sql, userId);
  const progress = await awardBadges(sql, userId, u, days);
  const stored = await sql<{ badge_id: string; earned_at: string | Date; seen_at: string | Date | null }[]>`
    SELECT badge_id, earned_at, seen_at FROM user_badges WHERE user_id = ${userId} ORDER BY earned_at`;
  const known = new Set(BADGES.map((b) => b.id as string));
  return {
    ...rewardsSummary(days, { closedThrough: u.closedThrough, today: u.today, weekStart: u.weekStart }),
    today: u.today,
    badges: stored.filter((b) => known.has(b.badge_id)).map((b) => ({ id: b.badge_id, earnedAt: new Date(b.earned_at).toISOString(), seen: !!b.seen_at })),
    progress,
  };
}

export async function markBadgesSeen(sql: Sql, userId: string, badgeIds: string[]) {
  if (!badgeIds.length) return 0;
  const rows = await sql`UPDATE user_badges SET seen_at = now() WHERE user_id = ${userId} AND badge_id = ANY(${badgeIds}) AND seen_at IS NULL RETURNING id`;
  return rows.length;
}
