import {
  RESERVED_USERNAMES,
  awardDef,
  itemHistory,
  itemSchema,
  occurrenceSchema,
  periodMonth,
  periodWeek,
  rewardsSummary,
  type ActivityEntry,
  type ActivityPayload,
  type FriendsPayload,
  type LastSnap,
  type Item,
  type LeaderboardPayload,
  type LeaderboardRow,
  type PersonProgress,
  type ProfilePatch,
  type PublicPerson,
  type ShareKind,
  type ShareRequest,
  type SharePayload,
} from "@life/shared";
import { randomBytes } from "node:crypto";
import type { Sql } from "postgres";
import { readDays, refreshRewards, userScoring } from "../rewards/engine.js";
import type { PushSender } from "../reminders/service.js";
import { toDto } from "../sync/sql.js";
import { blockedIds, friendIds, pair, people, visibleTo, type Db } from "./privacy.js";
import { pushToUser } from "./push.js";
import { markSnapDays, streaksFor, viewerDay } from "./streaks.js";

/*
 * Social (Phase 9a): profile, friends, invite links, leaderboards, podium
 * awards, shares, kudos and the Activity feed. Every read of another person's
 * progress goes through `visibleTo` (privacy.ts).
 */

export class SocialError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, code: string, message: string): never => {
  throw new SocialError(status, code, message);
};

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const iso = (v: string | Date) => new Date(v).toISOString();

/* ---------- profile ---------- */

export async function profile(sql: Db, userId: string) {
  const [u] = await sql<{ id: string; email: string | null; display_name: string | null; username: string | null; avatar_color: string | null; visibility: string | null }[]>`
    SELECT u.id, u.email, u.display_name, u.username, u.avatar_color, s.visibility FROM users u LEFT JOIN user_settings s ON s.user_id = u.id WHERE u.id = ${userId}`;
  return u
    ? { id: u.id, email: u.email, displayName: u.display_name, username: u.username, avatarColor: u.avatar_color, visibility: u.visibility ?? "friends" }
    : null;
}

export async function usernameAvailable(sql: Db, name: string, userId: string) {
  if (RESERVED_USERNAMES.has(name)) return false;
  const [row] = await sql<{ id: string }[]>`SELECT id FROM users WHERE username = ${name}`;
  return !row || row.id === userId;
}

export async function updateProfile(sql: Db, userId: string, patch: ProfilePatch) {
  if (patch.username !== undefined && !(await usernameAvailable(sql, patch.username, userId))) fail(409, "username_taken", "That username is taken.");
  try {
    await sql`
      UPDATE users SET
        display_name = COALESCE(${patch.displayName ?? null}, display_name),
        username = COALESCE(${patch.username ?? null}, username),
        avatar_color = COALESCE(${patch.avatarColor ?? null}, avatar_color)
      WHERE id = ${userId}`;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") fail(409, "username_taken", "That username is taken.");
    throw err;
  }
  return profile(sql, userId);
}

const needUsername = async (sql: Db, userId: string) => {
  const p = await profile(sql, userId);
  if (!p?.username) fail(409, "username_required", "Choose a username first.");
  return p!;
};

/* ---------- progress others may see ---------- */

export async function personProgress(sql: Db, userId: string): Promise<PersonProgress | null> {
  const u = await userScoring(sql, userId);
  if (!u) return null;
  const days = await readDays(sql, userId);
  const sum = rewardsSummary(days, { closedThrough: u.closedThrough, today: u.today, weekStart: u.weekStart });
  const month = periodMonth(u.today);
  return {
    weekPoints: sum.weekPoints,
    monthPoints: days.filter((d) => d.date >= month.from && d.date <= month.to).reduce((n, d) => n + d.points, 0),
    level: sum.level,
    streak: sum.streak.current,
  };
}

/* ---------- friends ---------- */

export async function friendsOf(sql: Db, userId: string): Promise<FriendsPayload> {
  const rows = await sql<{ user_a: string; user_b: string; status: string; requested_by: string; created_at: string; accepted_at: string | null }[]>`
    SELECT user_a, user_b, status, requested_by, created_at, accepted_at FROM friendships WHERE user_a = ${userId} OR user_b = ${userId}`;
  const blockedRows = await sql<{ blocked: string }[]>`SELECT blocked FROM blocks WHERE blocker = ${userId}`;
  const other = (r: { user_a: string; user_b: string }) => (r.user_a === userId ? r.user_b : r.user_a);
  const ids = [...rows.map(other), ...blockedRows.map((b) => b.blocked)];
  const ppl = await people(sql, ids);
  const accepted = rows.filter((r) => r.status === "accepted");
  const visible = await visibleTo(sql, userId, accepted.map(other));
  const friendIdsList = accepted.map(other);
  const streaks = await streaksFor(sql, userId, friendIdsList);
  const last = await lastSnaps(sql, userId, friendIdsList);
  const friends = await Promise.all(
    accepted.map(async (r) => {
      const id = other(r);
      return {
        ...ppl.get(id)!,
        progress: visible.has(id) ? await personProgress(sql, id) : null,
        since: iso(r.accepted_at ?? r.created_at),
        streak: streaks.get(id)!,
        last: last.get(id) ?? null,
      };
    }),
  );
  const pending = rows.filter((r) => r.status === "pending");
  // Like a chat list: streaks about to end first, then the most recent snaps.
  const order = (f: (typeof friends)[number]) => [f.streak.atRisk ? 0 : 1, -(f.last ? Date.parse(f.last.at) : 0)];
  return {
    friends: friends
      .filter((f) => f.id)
      .sort((a, b) => {
        const [x1, x2] = order(a);
        const [y1, y2] = order(b);
        return x1 - y1 || x2 - y2 || a.name.localeCompare(b.name);
      }),
    incoming: pending.filter((r) => r.requested_by !== userId).map((r) => ({ ...ppl.get(other(r))!, at: iso(r.created_at) })),
    outgoing: pending.filter((r) => r.requested_by === userId).map((r) => ({ ...ppl.get(other(r))!, at: iso(r.created_at) })),
    blocked: blockedRows.map((b) => ppl.get(b.blocked)!).filter(Boolean),
  };
}

/** The newest snap between me and each friend, either way. */
async function lastSnaps(sql: Db, userId: string, friendIds: string[]): Promise<Map<string, LastSnap>> {
  if (!friendIds.length) return new Map();
  const rows = await sql<{ id: string; sender_id: string; recipient_id: string; created_at: string; opened_at: string | null }[]>`
    SELECT DISTINCT ON (other) s.id, s.sender_id, r.recipient_id, s.created_at, r.opened_at,
      CASE WHEN s.sender_id = ${userId} THEN r.recipient_id ELSE s.sender_id END AS other
    FROM shares s JOIN share_recipients r ON r.share_id = s.id
    WHERE (s.sender_id = ${userId} AND r.recipient_id = ANY(${friendIds}::uuid[]))
       OR (r.recipient_id = ${userId} AND s.sender_id = ANY(${friendIds}::uuid[]))
    ORDER BY other, s.created_at DESC`;
  return new Map(
    rows.map((r) => {
      const out = r.sender_id === userId;
      return [out ? r.recipient_id : r.sender_id, { direction: out ? "out" : "in", at: iso(r.created_at), opened: !!r.opened_at, shareId: r.id }];
    }),
  );
}

async function isBlockedPair(sql: Db, a: string, b: string) {
  const [row] = await sql`SELECT 1 FROM blocks WHERE (blocker = ${a} AND blocked = ${b}) OR (blocker = ${b} AND blocked = ${a})`;
  return !!row;
}

type Deps = { sql: Sql; send: PushSender | null };

const nameOf = async (sql: Db, id: string) => (await people(sql, [id])).get(id)?.name ?? "Someone";

/** Ask someone by @username; if they had already asked you, you're friends. */
export async function requestFriend({ sql, send }: Deps, userId: string, username: string) {
  await needUsername(sql, userId);
  const [target] = await sql<{ id: string }[]>`SELECT id FROM users WHERE username = ${username}`;
  // Same answer for unknown and blocked: a block isn't revealed.
  if (!target || target.id === userId || (await isBlockedPair(sql, userId, target.id))) fail(404, "not_found", "No one with that username.");
  const [today] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM friendships WHERE requested_by = ${userId} AND created_at > now() - interval '1 day'`;
  if (today.n >= 20) fail(429, "too_many", "That's a lot of requests today — try again tomorrow.");
  const [a, b] = pair(userId, target.id);
  const [existing] = await sql<{ status: string; requested_by: string }[]>`SELECT status, requested_by FROM friendships WHERE user_a = ${a} AND user_b = ${b}`;
  if (existing?.status === "accepted") return { status: "friends" as const };
  if (existing?.status === "pending" && existing.requested_by !== userId) return acceptFriend({ sql, send }, userId, target.id);
  if (existing) return { status: "requested" as const };
  await sql`INSERT INTO friendships (user_a, user_b, status, requested_by) VALUES (${a}, ${b}, 'pending', ${userId}) ON CONFLICT DO NOTHING`;
  void pushToUser(sql, send, target.id, { title: "Friend request", body: `${await nameOf(sql, userId)} wants to be friends`, url: "/activity", tag: `friend:${userId}` }).catch(() => 0);
  return { status: "requested" as const };
}

export async function acceptFriend({ sql, send }: Deps, userId: string, otherId: string) {
  const [a, b] = pair(userId, otherId);
  const rows = await sql`
    UPDATE friendships SET status = 'accepted', accepted_at = now(), seen_at = NULL
    WHERE user_a = ${a} AND user_b = ${b} AND status = 'pending' AND requested_by = ${otherId} RETURNING id`;
  if (!rows.length) fail(404, "not_found", "That request is gone.");
  void pushToUser(sql, send, otherId, { title: "New friend", body: `${await nameOf(sql, userId)} accepted your request`, url: "/friends", tag: `friend:${userId}` }).catch(() => 0);
  return { status: "friends" as const };
}

/** Decline a request, cancel your own, or remove a friend. */
export async function removeFriend(sql: Db, userId: string, otherId: string) {
  const [a, b] = pair(userId, otherId);
  await sql`DELETE FROM friendships WHERE user_a = ${a} AND user_b = ${b}`;
  await sql`DELETE FROM visibility_allow WHERE (owner_id = ${userId} AND friend_id = ${otherId}) OR (owner_id = ${otherId} AND friend_id = ${userId})`;
  return { status: "none" as const };
}

export async function block(sql: Db, userId: string, otherId: string) {
  if (otherId === userId) fail(400, "self", "You can't block yourself.");
  await removeFriend(sql, userId, otherId);
  await sql`INSERT INTO blocks (blocker, blocked) VALUES (${userId}, ${otherId}) ON CONFLICT DO NOTHING`;
  return { status: "blocked" as const };
}

export async function unblock(sql: Db, userId: string, otherId: string) {
  await sql`DELETE FROM blocks WHERE blocker = ${userId} AND blocked = ${otherId}`;
  return { status: "none" as const };
}

export async function allowList(sql: Db, userId: string) {
  return (await sql<{ friend_id: string }[]>`SELECT friend_id FROM visibility_allow WHERE owner_id = ${userId}`).map((r) => r.friend_id);
}

export async function setAllowList(sql: Db, userId: string, ids: string[]) {
  const friends = new Set(await friendIds(sql, userId));
  const keep = [...new Set(ids)].filter((id) => friends.has(id));
  await sql`DELETE FROM visibility_allow WHERE owner_id = ${userId}`;
  if (keep.length) await sql`INSERT INTO visibility_allow ${sql(keep.map((friend_id) => ({ owner_id: userId, friend_id })), "owner_id", "friend_id")}`;
  return keep;
}

/* ---------- invite links ---------- */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const newCode = () => [...randomBytes(12)].map((b) => ALPHABET[b % ALPHABET.length]).join("");

export async function myInvite(sql: Db, userId: string, rotate = false) {
  if (rotate) await sql`UPDATE invite_links SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`;
  const [link] = await sql<{ code: string }[]>`SELECT code FROM invite_links WHERE user_id = ${userId} AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`;
  if (link) return { code: link.code };
  const code = newCode();
  await sql`INSERT INTO invite_links (user_id, code) VALUES (${userId}, ${code})`;
  return { code };
}

async function inviter(sql: Db, code: string) {
  const [link] = await sql<{ user_id: string }[]>`SELECT user_id FROM invite_links WHERE code = ${code} AND revoked_at IS NULL`;
  return link?.user_id ?? null;
}

/** The public card for an invite link: name, @username and avatar only. */
export async function invitePreview(sql: Db, code: string): Promise<PublicPerson | null> {
  const id = await inviter(sql, code);
  return id ? ((await people(sql, [id])).get(id) ?? null) : null;
}

/** Following someone's link makes you friends at once: the link is their consent. */
export async function acceptInvite({ sql, send }: Deps, userId: string, code: string) {
  const from = await inviter(sql, code);
  if (!from) fail(404, "not_found", "This invite link isn't valid any more.");
  if (from === userId) return { status: "self" as const, friend: null };
  if (await isBlockedPair(sql, userId, from)) fail(404, "not_found", "This invite link isn't valid any more.");
  const [a, b] = pair(userId, from);
  const [existing] = await sql<{ status: string }[]>`SELECT status FROM friendships WHERE user_a = ${a} AND user_b = ${b}`;
  const friend = (await people(sql, [from])).get(from) ?? null;
  if (existing?.status === "accepted") return { status: "friends" as const, friend };
  await sql`
    INSERT INTO friendships (user_a, user_b, status, requested_by, accepted_at) VALUES (${a}, ${b}, 'accepted', ${from}, now())
    ON CONFLICT (user_a, user_b) DO UPDATE SET status = 'accepted', accepted_at = now(), requested_by = ${from}, seen_at = NULL`;
  void pushToUser(sql, send, from, { title: "New friend", body: `${await nameOf(sql, userId)} joined you through your link`, url: "/friends", tag: `friend:${userId}` }).catch(() => 0);
  return { status: "friends" as const, friend };
}

/* ---------- leaderboards ---------- */

/** Competition ranking: equal points share a rank (1, 1, 3). */
export function rank<T extends { points: number; name: string }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const out: (T & { rank: number })[] = [];
  sorted.forEach((r, i) => out.push({ ...r, rank: i > 0 && sorted[i - 1].points === r.points ? out[i - 1].rank : i + 1 }));
  return out;
}

async function sums(sql: Db, ids: string[], from: string, to: string) {
  if (!ids.length) return new Map<string, number>();
  const rows = await sql<{ user_id: string; points: number }[]>`
    SELECT user_id, COALESCE(sum(points), 0)::int AS points FROM reward_days
    WHERE user_id = ANY(${ids}::uuid[]) AND date BETWEEN ${from}::date AND ${to}::date GROUP BY user_id`;
  return new Map(rows.map((r) => [r.user_id, r.points]));
}

export async function leaderboard(sql: Db, userId: string, board: "friends" | "everyone", period: "week" | "month"): Promise<LeaderboardPayload> {
  const u = await userScoring(sql, userId);
  if (!u) fail(404, "not_found", "No such account.");
  const range = period === "week" ? periodWeek(u!.today, u!.weekStart) : periodMonth(u!.today);
  const [me] = await sql<{ visibility: string | null }[]>`SELECT visibility FROM user_settings WHERE user_id = ${userId}`;
  const myVisibility = me?.visibility ?? "friends";
  let ids: string[];
  if (board === "friends") {
    const visible = await visibleTo(sql, userId, await friendIds(sql, userId));
    ids = [userId, ...visible];
  } else {
    const blocked = await blockedIds(sql, userId);
    const rows = await sql<{ user_id: string }[]>`
      SELECT rd.user_id FROM reward_days rd JOIN user_settings s ON s.user_id = rd.user_id
      WHERE s.visibility = 'everyone' AND rd.date BETWEEN ${range.from}::date AND ${range.to}::date
      GROUP BY rd.user_id HAVING sum(rd.points) > 0 ORDER BY sum(rd.points) DESC LIMIT 200`;
    ids = rows.map((r) => r.user_id).filter((id) => !blocked.has(id));
    if (myVisibility === "everyone" && !ids.includes(userId)) ids.push(userId);
  }
  const points = await sums(sql, ids, range.from, range.to);
  const ppl = await people(sql, ids);
  const ranked: LeaderboardRow[] = rank(ids.map((id) => ({ ...ppl.get(id)!, points: points.get(id) ?? 0 }))).map((r) => ({ ...r, you: r.id === userId }));
  const you = ranked.find((r) => r.you) ?? null;
  const rows = board === "everyone" ? ranked.filter((r) => r.rank <= 50 || r.you) : ranked;
  return { board, period, from: range.from, to: range.to, rows, you, hidden: board === "everyone" && myVisibility !== "everyone" };
}

/* ---------- podium awards ---------- */

/**
 * Gives the top three of a finished week (Mon–Sun) or month their award, once
 * per period: on the Everyone board, and on each person's own Friends board
 * when at least three people on it scored. "Finished" = ended 4+ days ago,
 * so every timezone's days are closed.
 */
export async function finalizePodiums(sql: Sql, now = new Date()) {
  const todayUtc = now.toISOString().slice(0, 10);
  const cutoff = addDays(todayUtc, -4);
  const lastWeek = periodWeek(addDays(periodWeek(todayUtc, 1).from, -1), 1);
  const lastMonth = periodMonth(addDays(periodMonth(todayUtc).from, -1));
  const periods = [
    { key: `week:${lastWeek.from}`, kind: "week", ...lastWeek },
    { key: `month:${lastMonth.from.slice(0, 7)}`, kind: "month", ...lastMonth },
  ].filter((p) => p.to <= cutoff);
  let given = 0;
  for (const p of periods) {
    const [done] = await sql`SELECT 1 FROM podium_periods WHERE period = ${p.key}`;
    if (done) continue;
    const start = p.kind === "week" ? p.from : p.from.slice(0, 7);
    const award = (userId: string, board: string, place: number) => ({ user_id: userId, badge_id: `podium:${board}:${p.kind}:${start}:${place}` });
    const awards: { user_id: string; badge_id: string }[] = [];
    // Everyone board.
    const everyone = await sql<{ user_id: string; points: number }[]>`
      SELECT rd.user_id, sum(rd.points)::int AS points FROM reward_days rd JOIN user_settings s ON s.user_id = rd.user_id
      WHERE s.visibility = 'everyone' AND rd.date BETWEEN ${p.from}::date AND ${p.to}::date
      GROUP BY rd.user_id HAVING sum(rd.points) > 0`;
    const names = await people(sql, everyone.map((r) => r.user_id));
    for (const r of rank(everyone.map((e) => ({ ...e, name: names.get(e.user_id)?.name ?? "" }))).filter((r) => r.rank <= 3)) awards.push(award(r.user_id, "global", r.rank));
    // Each person's Friends board.
    const members = await sql<{ id: string }[]>`SELECT DISTINCT unnest(ARRAY[user_a, user_b]) AS id FROM friendships WHERE status = 'accepted'`;
    for (const { id } of members) {
      const visible = await visibleTo(sql, id, await friendIds(sql, id));
      const ids = [id, ...visible];
      const pts = await sums(sql, ids, p.from, p.to);
      const scored = ids.filter((x) => (pts.get(x) ?? 0) > 0);
      if (scored.length < 3) continue;
      const ppl = await people(sql, scored);
      const me = rank(scored.map((x) => ({ id: x, points: pts.get(x)!, name: ppl.get(x)?.name ?? "" }))).find((r) => r.id === id);
      if (me && me.rank <= 3) awards.push(award(id, "friends", me.rank));
    }
    await sql.begin(async (tx) => {
      if (awards.length) await tx`INSERT INTO user_badges ${tx(awards, "user_id", "badge_id")} ON CONFLICT (user_id, badge_id) DO NOTHING`;
      await tx`INSERT INTO podium_periods (period) VALUES (${p.key}) ON CONFLICT DO NOTHING`;
    });
    given += awards.length;
  }
  return given;
}

/* ---------- shares ---------- */

async function loadItems(sql: Db, userId: string): Promise<Item[]> {
  return (await sql.unsafe(`SELECT row_to_json(t) AS r FROM items t WHERE t.user_id = $1 AND t.deleted_at IS NULL`, [userId]))
    .map((e) => itemSchema.safeParse(toDto(e.r as Record<string, unknown>)))
    .flatMap((p) => (p.success ? [p.data] : []));
}

/** Builds what a share shows from stored facts (never from the client). */
async function buildPayload(sql: Sql, userId: string, req: ShareRequest): Promise<SharePayload> {
  const u = await refreshRewards(sql, userId);
  if (!u) fail(404, "not_found", "No such account.");
  switch (req.kind) {
    case "day": {
      const date = req.date ?? u!.today;
      const days = await readDays(sql, userId);
      const d = days.find((x) => x.date === date);
      if (!d || date > u!.today) fail(404, "not_found", "Nothing to share for that day.");
      const ring = (fill: number, due: number): [number, number] | null => (due ? [fill, due] : null);
      return {
        kind: "day",
        date,
        complete: d!.complete,
        perfect: d!.perfect,
        rings: { prayer: ring(d!.prayerFill / 2, d!.prayerDue), commit: ring(d!.commitDone, d!.commitDue), balance: ring(d!.balanceDone, d!.balanceDue) },
      };
    }
    case "streak": {
      const days = await readDays(sql, userId);
      const s = rewardsSummary(days, { closedThrough: u!.closedThrough, today: u!.today, weekStart: u!.weekStart }).streak;
      if (s.current < 1) fail(400, "nothing", "Start a streak first.");
      return { kind: "streak", current: s.current, best: s.best };
    }
    case "award": {
      const [b] = await sql<{ earned_at: string }[]>`SELECT earned_at FROM user_badges WHERE user_id = ${userId} AND badge_id = ${req.awardId ?? ""}`;
      const def = req.awardId ? awardDef(req.awardId) : null;
      if (!b || !def) fail(404, "not_found", "You haven't earned that award.");
      return { kind: "award", awardId: def!.id, title: def!.title, icon: def!.icon, earnedAt: iso(b.earned_at) };
    }
    case "item_done": {
      const items = await loadItems(sql, userId);
      const item = items.find((i) => i.id === req.itemId);
      if (!item) fail(404, "not_found", "No such item.");
      const [o] = await sql<{ value: number | null }[]>`
        SELECT value FROM occurrences WHERE user_id = ${userId} AND item_id = ${item!.id} AND date = ${u!.today}::date AND status = 'done' AND deleted_at IS NULL LIMIT 1`;
      if (!o) fail(400, "not_done", "Finish it first — then snap it.");
      const t = item!.tracking;
      const unit = t.kind === "quantity" ? t.unit : t.kind === "duration" ? "min" : null;
      return { kind: "item_done", title: item!.title, date: u!.today, value: unit ? (o.value ?? null) : null, unit, prayer: typeof item!.meta.prayerKey === "string" };
    }
    case "item_streak": {
      const items = await loadItems(sql, userId);
      const item = items.find((i) => i.id === req.itemId);
      if (!item) fail(404, "not_found", "No such item.");
      const children = items.filter((i) => i.parentId === item!.id);
      const from = addDays(u!.today, -400);
      const ids = [item!.id, ...children.map((c) => c.id)];
      const occs = (
        await sql.unsafe(`SELECT row_to_json(t) AS r FROM occurrences t WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.item_id = ANY($2::uuid[]) AND t.date >= $3::date`, [
          userId,
          ids,
          from,
        ])
      )
        .map((e) => occurrenceSchema.safeParse(toDto(e.r as Record<string, unknown>)))
        .flatMap((p) => (p.success ? [p.data] : []));
      const h = itemHistory(item!, children, occs, from, u!.today, u!.today, u!.closedThrough);
      if (h.currentStreak < 1) fail(400, "nothing", "Start a streak first.");
      return { kind: "item_streak", title: item!.title, current: h.currentStreak, best: h.bestStreak, prayer: typeof item!.meta.prayerKey === "string" };
    }
  }
}

export async function createShare({ sql, send }: Deps, userId: string, req: ShareRequest) {
  await needUsername(sql, userId);
  const friends = new Set(await friendIds(sql, userId));
  const blocked = await blockedIds(sql, userId);
  const recipients = [...new Set(req.recipients)];
  if (recipients.some((r) => !friends.has(r) || blocked.has(r))) fail(403, "not_friends", "You can only share with friends.");
  const [today] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM shares WHERE sender_id = ${userId} AND created_at > now() - interval '1 day'`;
  if (today.n >= 30) fail(429, "too_many", "That's a lot of shares today — try again tomorrow.");
  const payload = await buildPayload(sql, userId, req);
  const share = await sql.begin(async (tx) => {
    const [s] = await tx<{ id: string }[]>`INSERT INTO shares (sender_id, kind, payload) VALUES (${userId}, ${req.kind}, ${JSON.stringify(payload)}::jsonb) RETURNING id`;
    await tx`INSERT INTO share_recipients ${tx(recipients.map((recipient_id) => ({ share_id: s.id, recipient_id })), "share_id", "recipient_id")}`;
    return s;
  });
  // Every snap keeps the streak with each recipient going (on the sender's own day).
  await markSnapDays(sql, userId, recipients, (await viewerDay(sql, userId)).today);
  const sender = await nameOf(sql, userId);
  for (const r of recipients) void pushToUser(sql, send, r, { title: `New snap from ${sender}`, body: "Tap to open it.", url: "/activity", tag: `share:${share.id}` }).catch(() => 0);
  return { id: share.id, payload };
}

/** Opens a snap once: the payload comes back the first time only (view once). */
export async function openSnap(sql: Db, userId: string, shareId: string) {
  const [r] = await sql<{ payload: SharePayload; opened_at: string | null; sender_id: string }[]>`
    SELECT s.payload, r.opened_at, s.sender_id FROM shares s JOIN share_recipients r ON r.share_id = s.id
    WHERE s.id = ${shareId} AND r.recipient_id = ${userId}`;
  if (!r || (await isBlockedPair(sql, userId, r.sender_id))) fail(404, "not_found", "That snap is gone.");
  if (r.opened_at) return { opened: true, payload: null };
  await sql`UPDATE share_recipients SET opened_at = now(), seen_at = COALESCE(seen_at, now()) WHERE share_id = ${shareId} AND recipient_id = ${userId}`;
  return { opened: false, payload: r.payload };
}

export async function sendKudos({ sql, send }: Deps, userId: string, shareId: string) {
  const [s] = await sql<{ sender_id: string; payload: SharePayload }[]>`
    SELECT s.sender_id, s.payload FROM shares s JOIN share_recipients r ON r.share_id = s.id WHERE s.id = ${shareId} AND r.recipient_id = ${userId}`;
  if (!s || (await isBlockedPair(sql, userId, s.sender_id))) fail(404, "not_found", "That share is gone.");
  const rows = await sql`INSERT INTO kudos (share_id, from_user) VALUES (${shareId}, ${userId}) ON CONFLICT DO NOTHING RETURNING id`;
  if (rows.length) {
    void pushToUser(sql, send, s.sender_id, { title: "Kudos!", body: `${await nameOf(sql, userId)} sent kudos on what you shared`, url: "/activity", tag: `kudos:${shareId}` }).catch(() => 0);
  }
  return { ok: true };
}

/* ---------- activity ---------- */

export async function activity(sql: Db, userId: string): Promise<ActivityPayload> {
  const blocked = await blockedIds(sql, userId);
  const received = await sql<{ id: string; sender_id: string; kind: string; payload: SharePayload; created_at: string; seen_at: string | null; opened_at: string | null; kudos: boolean }[]>`
    SELECT s.id, s.sender_id, s.kind, s.payload, s.created_at, r.seen_at, r.opened_at,
      EXISTS (SELECT 1 FROM kudos k WHERE k.share_id = s.id AND k.from_user = ${userId}) AS kudos
    FROM share_recipients r JOIN shares s ON s.id = r.share_id
    WHERE r.recipient_id = ${userId} ORDER BY s.created_at DESC LIMIT 50`;
  const kudosRows = await sql<{ id: string; from_user: string; payload: SharePayload; created_at: string; seen_at: string | null }[]>`
    SELECT k.id, k.from_user, s.payload, k.created_at, k.seen_at FROM kudos k JOIN shares s ON s.id = k.share_id
    WHERE s.sender_id = ${userId} ORDER BY k.created_at DESC LIMIT 50`;
  const requests = await sql<{ id: string; user_a: string; user_b: string; status: string; requested_by: string; created_at: string; accepted_at: string | null; seen_at: string | null }[]>`
    SELECT id, user_a, user_b, status, requested_by, created_at, accepted_at, seen_at FROM friendships
    WHERE (user_a = ${userId} OR user_b = ${userId})
      AND ((status = 'pending' AND requested_by <> ${userId}) OR (status = 'accepted' AND requested_by = ${userId} AND accepted_at > now() - interval '30 days'))`;
  const other = (r: { user_a: string; user_b: string }) => (r.user_a === userId ? r.user_b : r.user_a);
  const ppl = await people(sql, [...received.map((r) => r.sender_id), ...kudosRows.map((k) => k.from_user), ...requests.map(other)]);
  const entries: ActivityEntry[] = [
    ...received.filter((r) => !blocked.has(r.sender_id)).map(
        (r): ActivityEntry => ({
          type: "share",
          id: r.id,
          at: iso(r.created_at),
          from: ppl.get(r.sender_id)!,
          kind: r.kind as ShareKind,
          // View once: an opened snap keeps only who, what kind and when.
          payload: r.opened_at ? null : r.payload,
          opened: !!r.opened_at,
          kudosSent: r.kudos,
          seen: !!r.seen_at,
        }),
      ),
    ...kudosRows.filter((k) => !blocked.has(k.from_user)).map((k): ActivityEntry => ({ type: "kudos", id: k.id, at: iso(k.created_at), from: ppl.get(k.from_user)!, share: k.payload, seen: !!k.seen_at })),
    ...requests.map(
      (r): ActivityEntry =>
        r.status === "pending"
          ? { type: "request", id: r.id, at: iso(r.created_at), from: ppl.get(other(r))!, seen: !!r.seen_at }
          : { type: "accepted", id: r.id, at: iso(r.accepted_at ?? r.created_at), from: ppl.get(other(r))!, seen: !!r.seen_at },
    ),
  ]
    .filter((e) => e.from)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 60);
  return { entries, unread: entries.filter((e) => !e.seen).length };
}

export async function markActivitySeen(sql: Db, userId: string) {
  await sql`UPDATE share_recipients SET seen_at = now() WHERE recipient_id = ${userId} AND seen_at IS NULL`;
  await sql`UPDATE kudos k SET seen_at = now() FROM shares s WHERE s.id = k.share_id AND s.sender_id = ${userId} AND k.seen_at IS NULL`;
  await sql`
    UPDATE friendships SET seen_at = now() WHERE seen_at IS NULL AND (user_a = ${userId} OR user_b = ${userId})
      AND ((status = 'pending' AND requested_by <> ${userId}) OR (status = 'accepted' AND requested_by = ${userId}))`;
  return { ok: true };
}

