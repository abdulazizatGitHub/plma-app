import type { AvatarColor, PublicPerson } from "@life/shared";
import type { Sql, TransactionSql } from "postgres";

/*
 * Who may see whose progress (SOC-05/06, owner 2026-10-16). One rule, used by
 * every social read. Others only ever see a name, @username, avatar colour,
 * points, level, streak and awards — and only when this rule says yes. Item
 * titles leave their owner only inside a share the owner sent.
 */

export type Db = Sql | TransactionSql;
export type Visibility = "private" | "friends" | "selected" | "everyone";

export type SeeInput = {
  self: boolean;
  /** Either side blocked the other. */
  blocked: boolean;
  friends: boolean;
  /** On the owner's "selected friends" list. */
  allowed: boolean;
  visibility: Visibility;
};

/** The rule itself (pure, unit-tested). */
export function canSeeRule(i: SeeInput): boolean {
  if (i.self) return true;
  if (i.blocked) return false;
  switch (i.visibility) {
    case "everyone":
      return true;
    case "friends":
      return i.friends;
    case "selected":
      return i.friends && i.allowed;
    default:
      return false;
  }
}

/** The ordered pair a friendship is stored under (user_a < user_b). */
export const pair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

/** Accepted friends of `userId`. */
export async function friendIds(sql: Db, userId: string): Promise<string[]> {
  const rows = await sql<{ other: string }[]>`
    SELECT CASE WHEN user_a = ${userId} THEN user_b ELSE user_a END AS other
    FROM friendships WHERE status = 'accepted' AND (user_a = ${userId} OR user_b = ${userId})`;
  return rows.map((r) => r.other);
}

/** Users either side has blocked, relative to `userId`. */
export async function blockedIds(sql: Db, userId: string): Promise<Set<string>> {
  const rows = await sql<{ other: string }[]>`
    SELECT CASE WHEN blocker = ${userId} THEN blocked ELSE blocker END AS other
    FROM blocks WHERE blocker = ${userId} OR blocked = ${userId}`;
  return new Set(rows.map((r) => r.other));
}

/** Of `ownerIds`, the ones whose progress `viewer` may see. */
export async function visibleTo(sql: Db, viewer: string, ownerIds: string[]): Promise<Set<string>> {
  if (!ownerIds.length) return new Set();
  const [friends, blocked] = await Promise.all([friendIds(sql, viewer), blockedIds(sql, viewer)]);
  const friendSet = new Set(friends);
  const settings = await sql<{ user_id: string; visibility: string | null }[]>`
    SELECT u.id AS user_id, s.visibility FROM users u LEFT JOIN user_settings s ON s.user_id = u.id WHERE u.id = ANY(${ownerIds}::uuid[])`;
  const allowRows = await sql<{ owner_id: string }[]>`
    SELECT owner_id FROM visibility_allow WHERE friend_id = ${viewer} AND owner_id = ANY(${ownerIds}::uuid[])`;
  const allowed = new Set(allowRows.map((r) => r.owner_id));
  const out = new Set<string>();
  for (const s of settings) {
    const ok = canSeeRule({
      self: s.user_id === viewer,
      blocked: blocked.has(s.user_id),
      friends: friendSet.has(s.user_id),
      allowed: allowed.has(s.user_id),
      visibility: (s.visibility ?? "friends") as Visibility,
    });
    if (ok) out.add(s.user_id);
  }
  return out;
}

/** Name, @username and avatar colour for each id (what anyone may see of a person). */
export async function people(sql: Db, ids: string[]): Promise<Map<string, PublicPerson>> {
  if (!ids.length) return new Map();
  const rows = await sql<{ id: string; display_name: string | null; username: string | null; avatar_color: string | null; email: string | null }[]>`
    SELECT id, display_name, username, avatar_color, email FROM users WHERE id = ANY(${[...new Set(ids)]}::uuid[])`;
  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        // Never fall back to the email: it isn't public.
        name: r.display_name?.trim() || (r.username ? `@${r.username}` : "Someone"),
        username: r.username,
        avatarColor: (r.avatar_color as AvatarColor | null) ?? null,
      },
    ]),
  );
}
