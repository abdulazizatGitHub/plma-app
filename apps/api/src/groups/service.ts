import {
  GROUP_MAX_GOALS,
  GROUP_MAX_MEMBERS,
  TOGETHER_BONUS,
  goalRange,
  goalStatus,
  goalValue,
  groupScore,
  groupStreak,
  periodMonth,
  periodWeek,
  type GoalDraft,
  type GoalView,
  type GroupBoardRow,
  type GroupDetail,
  type GroupDraft,
  type GroupIcon,
  type GroupInvite,
  type GroupRole,
  type GroupsPayload,
  type GroupSummary,
  type PublicPerson,
} from "@life/shared";
import { randomBytes, randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type { PushSender } from "../reminders/service.js";
import { SocialError } from "../social/service.js";
import { friendIds, people, type Db } from "../social/privacy.js";
import { pushToUser } from "../social/push.js";
import { viewerDay } from "../social/streaks.js";
import { buildUpsert } from "../sync/sql.js";

/*
 * Groups (Phase 9b, owner 2026-10-16). Members only ever see each other's
 * name, avatar and progress on group goals. A goal puts a linked item on each
 * member's own Today (server-made, `items.group_goal_id`); progress is read
 * from those items' entries. Rewards are given once, after the period closes.
 */

type Deps = { sql: Sql; send: PushSender | null };
const fail = (status: number, code: string, message: string): never => {
  throw new SocialError(status, code, message);
};
const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const isoDay = (v: string | Date) => (typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const newCode = () => [...randomBytes(12)].map((b) => ALPHABET[b % ALPHABET.length]).join("");

type GroupRow = { id: string; name: string; icon: string; color: string; owner_id: string; visibility: string; archived_at: string | null };
type GoalRow = {
  id: string;
  group_id: string;
  title: string;
  mode: "each" | "together";
  tracking: "check" | "quantity" | "duration";
  unit: string | null;
  target: number;
  starts_on: string | Date;
  ends_on: string | Date;
  reward: string | null;
  archived_at: string | null;
  finalized_at: string | null;
};

/* ---------- membership ---------- */

async function roleOf(sql: Db, groupId: string, userId: string): Promise<GroupRole | null> {
  const [m] = await sql<{ role: GroupRole }[]>`
    SELECT gm.role FROM group_members gm JOIN groups g ON g.id = gm.group_id
    WHERE gm.group_id = ${groupId} AND gm.user_id = ${userId} AND gm.left_at IS NULL AND g.archived_at IS NULL`;
  return m?.role ?? null;
}
async function requireMember(sql: Db, groupId: string, userId: string) {
  const role = await roleOf(sql, groupId, userId);
  // Same answer for "no such group" and "not a member": a group's existence isn't revealed.
  if (!role) fail(404, "not_found", "No such group.");
  return role!;
}
async function requireAdmin(sql: Db, groupId: string, userId: string) {
  const role = await requireMember(sql, groupId, userId);
  if (role === "member") fail(403, "admins_only", "Only the group's admins can do that.");
  return role;
}
async function memberIds(sql: Db, groupId: string): Promise<string[]> {
  return (await sql<{ user_id: string }[]>`SELECT user_id FROM group_members WHERE group_id = ${groupId} AND left_at IS NULL ORDER BY joined_at`).map((r) => r.user_id);
}
async function groupRow(sql: Db, groupId: string): Promise<GroupRow> {
  const [g] = await sql<GroupRow[]>`SELECT id, name, icon, color, owner_id, visibility, archived_at FROM groups WHERE id = ${groupId}`;
  if (!g || g.archived_at) fail(404, "not_found", "No such group.");
  return g;
}

/* ---------- linked items (each member's own Today) ---------- */

/** A friendly −/+ step for a count goal, e.g. 70,000 steps over a week → 1,000. */
function stepFor(target: number, days: number) {
  const perDay = target / Math.max(1, days);
  const steps = [1, 5, 10, 50, 100, 250, 500, 1000, 2500, 5000];
  return steps.filter((s) => s <= Math.max(1, perDay / 8)).at(-1) ?? 1;
}

function linkedItemRow(goal: GoalRow, group: Pick<GroupRow, "id" | "name">, userId: string, now: string) {
  const from = isoDay(goal.starts_on);
  const to = isoDay(goal.ends_on);
  const tracking =
    goal.tracking === "quantity"
      ? { v: 1, kind: "quantity", unit: goal.unit ?? "times", step: stepFor(goal.target, daysBetween(from, to) + 1) }
      : goal.tracking === "duration"
        ? { v: 1, kind: "duration" }
        : { v: 1, kind: "check" };
  return {
    id: randomUUID(),
    userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    categoryId: null,
    parentId: null,
    type: "habit",
    title: goal.title,
    notes: null,
    priority: "medium",
    isOptional: false,
    tracking,
    schedule: { v: 1, kind: "daily", activeFrom: from, activeUntil: to },
    meta: { groupId: group.id, groupName: group.name, groupGoal: { mode: goal.mode, target: goal.target, unit: goal.unit } },
    groupGoalId: goal.id,
    sortOrder: 0,
    archivedAt: null,
    sourceTemplateId: null,
    sourceTemplateVersion: null,
    adoptedAt: null,
  };
}

/** Puts the goal's item on each member's Today (skipping anyone who already has it). */
async function addLinkedItems(sql: Db, goal: GoalRow, group: Pick<GroupRow, "id" | "name">, userIds: string[]) {
  const now = new Date().toISOString();
  const have = new Set(
    (await sql<{ user_id: string }[]>`SELECT user_id FROM items WHERE group_goal_id = ${goal.id} AND deleted_at IS NULL AND archived_at IS NULL`).map((r) => r.user_id),
  );
  for (const userId of userIds.filter((u) => !have.has(u))) {
    const { text, params } = buildUpsert("items", [linkedItemRow(goal, group, userId, now)], userId);
    await sql.unsafe(text, params as never[]);
  }
}

/** Takes a goal's items off members' Todays (archived, so their history stays). */
async function archiveLinkedItems(sql: Db, goalIds: string[], userId?: string) {
  if (!goalIds.length) return;
  const now = new Date().toISOString();
  if (userId)
    await sql`UPDATE items SET archived_at = ${now}, updated_at = ${now}, synced_at = now() WHERE group_goal_id = ANY(${goalIds}::uuid[]) AND user_id = ${userId} AND archived_at IS NULL`;
  else await sql`UPDATE items SET archived_at = ${now}, updated_at = ${now}, synced_at = now() WHERE group_goal_id = ANY(${goalIds}::uuid[]) AND archived_at IS NULL`;
}

async function activeGoals(sql: Db, groupId: string, today: string): Promise<GoalRow[]> {
  return sql<GoalRow[]>`
    SELECT * FROM group_goals WHERE group_id = ${groupId} AND archived_at IS NULL AND ends_on >= ${today}::date ORDER BY ends_on, created_at`;
}

/* ---------- goal progress ---------- */

async function goalView(sql: Db, goal: GoalRow, members: string[], ppl: Map<string, PublicPerson>, today: string): Promise<GoalView> {
  const from = isoDay(goal.starts_on);
  const to = isoDay(goal.ends_on);
  const rows = await sql<{ user_id: string; date: string | Date; status: string; value: number | null }[]>`
    SELECT o.user_id, o.date, o.status, o.value FROM occurrences o JOIN items i ON i.id = o.item_id
    WHERE i.group_goal_id = ${goal.id} AND o.deleted_at IS NULL AND o.date BETWEEN ${from}::date AND ${to}::date AND o.user_id = ANY(${members}::uuid[])`;
  const byUser = new Map<string, { date: string; status: string; value: number | null }[]>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), { date: isoDay(r.date), status: r.status, value: r.value }]);
  const list = members.map((id) => {
    const value = goalValue(goal.tracking, byUser.get(id) ?? [], from, to);
    return { ...ppl.get(id)!, value, met: goal.mode === "each" ? value >= goal.target : false };
  });
  const { total, met } = goalStatus(goal.mode, goal.target, list.map((m) => m.value));
  return {
    id: goal.id,
    title: goal.title,
    mode: goal.mode,
    tracking: goal.tracking,
    unit: goal.unit,
    target: goal.target,
    from,
    to,
    reward: goal.reward,
    members: list.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)),
    total,
    met,
    daysLeft: Math.max(0, daysBetween(today, to)),
    finished: to < today,
  };
}

/* ---------- streak ---------- */

async function streakOf(sql: Db, groupId: string, count: number, userId: string) {
  const v = await viewerDay(sql, userId);
  const rows = await sql<{ date: string | Date; n: number }[]>`
    SELECT date, count(*)::int AS n FROM group_snap_days WHERE group_id = ${groupId} AND date >= ${addDays(v.today, -400)}::date GROUP BY date`;
  return groupStreak(new Map(rows.map((r) => [isoDay(r.date), r.n])), count, v.today, new Date(), v);
}

/* ---------- reads ---------- */

async function summary(sql: Db, g: GroupRow, userId: string, today: string): Promise<GroupSummary> {
  const ids = await memberIds(sql, g.id);
  const ppl = await people(sql, ids);
  const goals = await activeGoals(sql, g.id, today);
  const first = goals[0] ? await goalView(sql, goals[0], ids, ppl, today) : null;
  return {
    id: g.id,
    name: g.name,
    icon: g.icon as GroupIcon,
    color: g.color,
    role: (await roleOf(sql, g.id, userId))!,
    members: ids.slice(0, 6).map((id) => ppl.get(id)!).filter(Boolean),
    memberCount: ids.length,
    streak: await streakOf(sql, g.id, ids.length, userId),
    goal: first ? { id: first.id, title: first.title, mode: first.mode, target: first.target, total: first.total, met: first.met, unit: first.unit } : null,
  };
}

export async function myGroups(sql: Db, userId: string): Promise<GroupsPayload> {
  const { today } = await viewerDay(sql, userId);
  const rows = await sql<GroupRow[]>`
    SELECT g.id, g.name, g.icon, g.color, g.owner_id, g.visibility, g.archived_at FROM groups g JOIN group_members m ON m.group_id = g.id
    WHERE m.user_id = ${userId} AND m.left_at IS NULL AND g.archived_at IS NULL ORDER BY g.created_at`;
  const invites = await sql<{ id: string; group_id: string; name: string; icon: string; color: string; invited_by: string; created_at: string }[]>`
    SELECT i.id, i.group_id, g.name, g.icon, g.color, i.invited_by, i.created_at FROM group_invites i JOIN groups g ON g.id = i.group_id
    WHERE i.invited_user = ${userId} AND g.archived_at IS NULL ORDER BY i.created_at DESC`;
  const ppl = await people(sql, invites.map((i) => i.invited_by));
  const counts = new Map<string, number>();
  for (const i of invites) counts.set(i.group_id, (await memberIds(sql, i.group_id)).length);
  return {
    groups: await Promise.all(rows.map((g) => summary(sql, g, userId, today))),
    invites: invites.map(
      (i): GroupInvite => ({
        id: i.id,
        group: { id: i.group_id, name: i.name, icon: i.icon as GroupIcon, color: i.color, memberCount: counts.get(i.group_id) ?? 0 },
        from: ppl.get(i.invited_by)!,
        at: new Date(i.created_at).toISOString(),
      }),
    ),
  };
}

export async function groupDetail(sql: Db, userId: string, groupId: string): Promise<GroupDetail> {
  const role = await requireMember(sql, groupId, userId);
  const g = await groupRow(sql, groupId);
  const { today } = await viewerDay(sql, userId);
  const ids = await memberIds(sql, groupId);
  const ppl = await people(sql, ids);
  const roleRows = await sql<{ user_id: string; role: GroupRole }[]>`SELECT user_id, role FROM group_members WHERE group_id = ${groupId} AND left_at IS NULL`;
  // Active goals plus those that ended in the last week (to see how it went).
  const goals = await sql<GoalRow[]>`
    SELECT * FROM group_goals WHERE group_id = ${groupId} AND archived_at IS NULL AND ends_on >= ${addDays(today, -7)}::date ORDER BY ends_on, created_at`;
  const snapped = await sql<{ user_id: string }[]>`SELECT DISTINCT user_id FROM group_snap_days WHERE group_id = ${groupId} AND date = ${today}::date`;
  const [link] = role !== "member" ? await sql<{ code: string }[]>`SELECT code FROM group_links WHERE group_id = ${groupId} AND revoked_at IS NULL LIMIT 1` : [];
  const base = await summary(sql, g, userId, today);
  return {
    ...base,
    members: ids.map((id) => ppl.get(id)!).filter(Boolean),
    visibility: g.visibility as "members" | "everyone",
    roles: Object.fromEntries(roleRows.map((r) => [r.user_id, r.role])),
    goals: await Promise.all(goals.map((goal) => goalView(sql, goal, ids, ppl, today))),
    snappedToday: snapped.map((s) => ppl.get(s.user_id)!).filter(Boolean),
    inviteCode: link?.code ?? null,
  };
}

/* ---------- writes ---------- */

export async function createGroup(sql: Sql, userId: string, d: GroupDraft) {
  const [p] = await sql<{ username: string | null }[]>`SELECT username FROM users WHERE id = ${userId}`;
  if (!p?.username) fail(409, "username_required", "Choose a username first.");
  const [owned] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM groups WHERE owner_id = ${userId} AND archived_at IS NULL`;
  if (owned.n >= 20) fail(429, "too_many", "You own a lot of groups already.");
  const id = await sql.begin(async (tx) => {
    const [g] = await tx<{ id: string }[]>`INSERT INTO groups (name, icon, color, owner_id, visibility) VALUES (${d.name}, ${d.icon}, ${d.color}, ${userId}, ${d.visibility}) RETURNING id`;
    await tx`INSERT INTO group_members (group_id, user_id, role) VALUES (${g.id}, ${userId}, 'owner')`;
    return g.id;
  });
  return groupDetail(sql, userId, id);
}

export async function updateGroup(sql: Db, userId: string, groupId: string, d: Partial<GroupDraft>) {
  await requireAdmin(sql, groupId, userId);
  await sql`
    UPDATE groups SET name = COALESCE(${d.name ?? null}, name), icon = COALESCE(${d.icon ?? null}, icon),
      color = COALESCE(${d.color ?? null}, color), visibility = COALESCE(${d.visibility ?? null}, visibility)
    WHERE id = ${groupId}`;
  return groupDetail(sql, userId, groupId);
}

async function join(deps: Deps, groupId: string, userId: string) {
  const { sql, send } = deps;
  const g = await groupRow(sql, groupId);
  const ids = await memberIds(sql, groupId);
  if (ids.includes(userId)) return;
  if (ids.length >= GROUP_MAX_MEMBERS) fail(409, "group_full", `This group is full (${GROUP_MAX_MEMBERS} members).`);
  await sql`
    INSERT INTO group_members (group_id, user_id, role) VALUES (${groupId}, ${userId}, 'member')
    ON CONFLICT (group_id, user_id) DO UPDATE SET left_at = NULL, role = 'member', joined_at = now()`;
  await sql`DELETE FROM group_invites WHERE group_id = ${groupId} AND invited_user = ${userId}`;
  const { today } = await viewerDay(sql, userId);
  for (const goal of await activeGoals(sql, groupId, today)) await addLinkedItems(sql, goal, g, [userId]);
  const name = (await people(sql, [userId])).get(userId)?.name ?? "Someone";
  for (const m of ids) void pushToUser(sql, send, m, { title: g.name, body: `${name} joined the group`, url: `/groups/view?id=${groupId}`, tag: `group:${groupId}` }).catch(() => 0);
}

export async function leaveGroup(sql: Db, userId: string, groupId: string) {
  const role = await requireMember(sql, groupId, userId);
  const goalIds = (await sql<{ id: string }[]>`SELECT id FROM group_goals WHERE group_id = ${groupId}`).map((r) => r.id);
  await archiveLinkedItems(sql, goalIds, userId);
  await sql`UPDATE group_members SET left_at = now() WHERE group_id = ${groupId} AND user_id = ${userId}`;
  if (role === "owner") {
    // Hand the group to the longest-standing admin, else member; with no one left it closes.
    const [next] = await sql<{ user_id: string }[]>`
      SELECT user_id FROM group_members WHERE group_id = ${groupId} AND left_at IS NULL
      ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, joined_at LIMIT 1`;
    if (next) {
      await sql`UPDATE group_members SET role = 'owner' WHERE group_id = ${groupId} AND user_id = ${next.user_id}`;
      await sql`UPDATE groups SET owner_id = ${next.user_id} WHERE id = ${groupId}`;
    } else await sql`UPDATE groups SET archived_at = now() WHERE id = ${groupId}`;
  }
  return { ok: true };
}

export async function deleteGroup(sql: Db, userId: string, groupId: string) {
  const role = await requireMember(sql, groupId, userId);
  if (role !== "owner") fail(403, "owner_only", "Only the owner can delete the group.");
  const goalIds = (await sql<{ id: string }[]>`SELECT id FROM group_goals WHERE group_id = ${groupId}`).map((r) => r.id);
  await archiveLinkedItems(sql, goalIds);
  await sql`UPDATE groups SET archived_at = now() WHERE id = ${groupId}`;
  return { ok: true };
}

export async function inviteFriends(deps: Deps, userId: string, groupId: string, ids: string[]) {
  const { sql, send } = deps;
  await requireAdmin(sql, groupId, userId);
  const g = await groupRow(sql, groupId);
  const friends = new Set(await friendIds(sql, userId));
  const members = new Set(await memberIds(sql, groupId));
  const targets = [...new Set(ids)].filter((id) => friends.has(id) && !members.has(id));
  if (members.size + targets.length > GROUP_MAX_MEMBERS) fail(409, "group_full", `A group can have up to ${GROUP_MAX_MEMBERS} members.`);
  const name = (await people(sql, [userId])).get(userId)?.name ?? "Someone";
  for (const t of targets) {
    const rows = await sql`INSERT INTO group_invites (group_id, invited_user, invited_by) VALUES (${groupId}, ${t}, ${userId}) ON CONFLICT DO NOTHING RETURNING id`;
    if (rows.length) void pushToUser(sql, send, t, { title: "Group invite", body: `${name} invited you to ${g.name}`, url: "/groups", tag: `group-invite:${groupId}` }).catch(() => 0);
  }
  return { invited: targets.length };
}

export async function answerInvite(deps: Deps, userId: string, inviteId: string, accept: boolean) {
  const [i] = await deps.sql<{ group_id: string }[]>`SELECT group_id FROM group_invites WHERE id = ${inviteId} AND invited_user = ${userId}`;
  if (!i) fail(404, "not_found", "That invite is gone.");
  if (accept) await join(deps, i.group_id, userId);
  else await deps.sql`DELETE FROM group_invites WHERE id = ${inviteId}`;
  return { ok: true, groupId: i.group_id };
}

export async function groupLink(sql: Db, userId: string, groupId: string, rotate = false) {
  await requireAdmin(sql, groupId, userId);
  if (rotate) await sql`UPDATE group_links SET revoked_at = now() WHERE group_id = ${groupId} AND revoked_at IS NULL`;
  const [l] = await sql<{ code: string }[]>`SELECT code FROM group_links WHERE group_id = ${groupId} AND revoked_at IS NULL LIMIT 1`;
  if (l) return { code: l.code };
  const code = newCode();
  await sql`INSERT INTO group_links (group_id, code) VALUES (${groupId}, ${code})`;
  return { code };
}

async function linkGroup(sql: Db, code: string) {
  const [l] = await sql<{ group_id: string }[]>`SELECT l.group_id FROM group_links l JOIN groups g ON g.id = l.group_id WHERE l.code = ${code} AND l.revoked_at IS NULL AND g.archived_at IS NULL`;
  return l?.group_id ?? null;
}

/** Public card for a group link: its name, icon and size only. */
export async function groupLinkPreview(sql: Db, code: string) {
  const id = await linkGroup(sql, code);
  if (!id) return null;
  const g = await groupRow(sql, id);
  return { name: g.name, icon: g.icon, color: g.color, memberCount: (await memberIds(sql, id)).length };
}

export async function acceptGroupLink(deps: Deps, userId: string, code: string) {
  const id = await linkGroup(deps.sql, code);
  if (!id) fail(404, "not_found", "This group link isn't valid any more.");
  await join(deps, id, userId);
  const g = await groupRow(deps.sql, id);
  return { ok: true, groupId: id, name: g.name };
}

export async function setRole(sql: Db, userId: string, groupId: string, memberId: string, role: "admin" | "member" | "remove") {
  const mine = await requireAdmin(sql, groupId, userId);
  const theirs = await roleOf(sql, groupId, memberId);
  if (!theirs) fail(404, "not_found", "Not a member.");
  if (theirs === "owner") fail(403, "owner", "The owner can't be changed.");
  if (role === "admin" && mine !== "owner") fail(403, "owner_only", "Only the owner can make admins.");
  if (role === "remove") {
    if (theirs === "admin" && mine !== "owner") fail(403, "owner_only", "Only the owner can remove an admin.");
    return leaveGroup(sql, memberId, groupId);
  }
  await sql`UPDATE group_members SET role = ${role} WHERE group_id = ${groupId} AND user_id = ${memberId}`;
  return { ok: true };
}

export async function createGoal(deps: Deps, userId: string, groupId: string, d: GoalDraft) {
  const { sql, send } = deps;
  await requireAdmin(sql, groupId, userId);
  const g = await groupRow(sql, groupId);
  const v = await viewerDay(sql, userId);
  const [ws] = await sql<{ week_start: number | null }[]>`SELECT week_start FROM user_settings WHERE user_id = ${userId}`;
  if ((await activeGoals(sql, groupId, v.today)).length >= GROUP_MAX_GOALS) fail(409, "too_many", `A group can run up to ${GROUP_MAX_GOALS} goals at once.`);
  const range = goalRange(d, v.today, ws?.week_start ?? 1);
  if (range.to < v.today) fail(400, "past", "That period has already ended.");
  const [goal] = await sql<GoalRow[]>`
    INSERT INTO group_goals (group_id, title, mode, tracking, unit, target, starts_on, ends_on, reward, created_by)
    VALUES (${groupId}, ${d.title}, ${d.mode}, ${d.tracking}, ${d.tracking === "quantity" ? (d.unit ?? null) : d.tracking === "duration" ? "min" : null},
            ${d.target}, ${range.from}, ${range.to}, ${d.reward ?? null}, ${userId})
    RETURNING *`;
  const ids = await memberIds(sql, groupId);
  await addLinkedItems(sql, goal, g, ids);
  for (const m of ids.filter((x) => x !== userId))
    void pushToUser(sql, send, m, { title: g.name, body: `New goal: ${d.title}`, url: `/groups/view?id=${groupId}`, tag: `goal:${goal.id}` }).catch(() => 0);
  return groupDetail(sql, userId, groupId);
}

export async function archiveGoal(sql: Db, userId: string, groupId: string, goalId: string) {
  await requireAdmin(sql, groupId, userId);
  await sql`UPDATE group_goals SET archived_at = now() WHERE id = ${goalId} AND group_id = ${groupId}`;
  await archiveLinkedItems(sql, [goalId]);
  return { ok: true };
}

/** A check-in to the group (once per member per day) — the group streak. */
export async function snapGroup(deps: Deps, userId: string, groupId: string) {
  const { sql, send } = deps;
  await requireMember(sql, groupId, userId);
  const g = await groupRow(sql, groupId);
  const { today } = await viewerDay(sql, userId);
  const fresh = await sql`INSERT INTO group_snap_days (group_id, user_id, date) VALUES (${groupId}, ${userId}, ${today}) ON CONFLICT DO NOTHING RETURNING id`;
  if (fresh.length) {
    const name = (await people(sql, [userId])).get(userId)?.name ?? "Someone";
    for (const m of (await memberIds(sql, groupId)).filter((x) => x !== userId))
      void pushToUser(sql, send, m, { title: g.name, body: `${name} checked in — your turn`, url: `/groups/view?id=${groupId}`, tag: `group-snap:${groupId}` }).catch(() => 0);
  }
  return groupDetail(sql, userId, groupId);
}

/* ---------- boards ---------- */

async function groupPoints(sql: Db, groupId: string, from: string, to: string) {
  const ids = await memberIds(sql, groupId);
  if (!ids.length) return groupScore([]);
  const rows = await sql<{ user_id: string; points: number }[]>`
    SELECT user_id, COALESCE(sum(points), 0)::int AS points FROM reward_days
    WHERE user_id = ANY(${ids}::uuid[]) AND date BETWEEN ${from}::date AND ${to}::date GROUP BY user_id`;
  const m = new Map(rows.map((r) => [r.user_id, r.points]));
  return groupScore(ids.map((id) => m.get(id) ?? 0));
}

const rankRows = <T extends { average: number; name: string }>(rows: T[]) => {
  const sorted = [...rows].sort((a, b) => b.average - a.average || a.name.localeCompare(b.name));
  const out: (T & { rank: number })[] = [];
  sorted.forEach((r, i) => out.push({ ...r, rank: i > 0 && sorted[i - 1].average === r.average ? out[i - 1].rank : i + 1 }));
  return out;
};

/** Group vs group by average points per active member: my groups, or public ones. */
export async function groupBoard(sql: Db, userId: string, period: "week" | "month", scope: "mine" | "public"): Promise<{ rows: GroupBoardRow[]; from: string; to: string }> {
  const v = await viewerDay(sql, userId);
  const [ws] = await sql<{ week_start: number | null }[]>`SELECT week_start FROM user_settings WHERE user_id = ${userId}`;
  const range = period === "week" ? periodWeek(v.today, ws?.week_start ?? 1) : periodMonth(v.today);
  const mine = new Set(
    (await sql<{ group_id: string }[]>`SELECT group_id FROM group_members WHERE user_id = ${userId} AND left_at IS NULL`).map((r) => r.group_id),
  );
  const list =
    scope === "mine"
      ? await sql<GroupRow[]>`SELECT id, name, icon, color, owner_id, visibility, archived_at FROM groups WHERE id = ANY(${[...mine]}::uuid[]) AND archived_at IS NULL`
      : await sql<GroupRow[]>`SELECT id, name, icon, color, owner_id, visibility, archived_at FROM groups WHERE visibility = 'everyone' AND archived_at IS NULL LIMIT 200`;
  const scored = await Promise.all(list.map(async (g) => ({ id: g.id, name: g.name, icon: g.icon as GroupIcon, color: g.color, mine: mine.has(g.id), ...(await groupPoints(sql, g.id, range.from, range.to)) })));
  const rows = rankRows(scope === "public" ? scored.filter((s) => s.active > 0) : scored);
  return { rows: scope === "public" ? rows.filter((r) => r.rank <= 50 || r.mine) : rows, from: range.from, to: range.to };
}

/* ---------- finalising (hourly sweep) ---------- */

/**
 * Once a goal's period has closed (4+ days after it ended, so every member's
 * days are final): results are stored, members who met it get the award, and
 * a met "together" goal gives each contributor +10. Once per goal.
 */
export async function finalizeGroupGoals(sql: Sql, now = new Date()) {
  const cutoff = addDays(now.toISOString().slice(0, 10), -4);
  const due = await sql<GoalRow[]>`SELECT * FROM group_goals WHERE finalized_at IS NULL AND archived_at IS NULL AND ends_on <= ${cutoff}::date`;
  let rewarded = 0;
  for (const goal of due) {
    const ids = await memberIds(sql, goal.group_id);
    const view = await goalView(sql, goal, ids, await people(sql, ids), cutoff);
    await sql.begin(async (tx) => {
      for (const m of view.members) {
        const met = goal.mode === "each" ? m.value >= goal.target : view.met && m.value > 0;
        await tx`
          INSERT INTO group_goal_results (goal_id, user_id, value, met_at) VALUES (${goal.id}, ${m.id}, ${m.value}, ${met ? new Date().toISOString() : null})
          ON CONFLICT (goal_id, user_id) DO NOTHING`;
        if (!met) continue;
        rewarded += 1;
        await tx`INSERT INTO user_badges (user_id, badge_id) VALUES (${m.id}, ${`group_goal:${goal.id}`}) ON CONFLICT DO NOTHING`;
        if (goal.mode === "together")
          await tx`
            INSERT INTO bonus_points (user_id, key, points, date, reason) VALUES (${m.id}, ${`group_goal:${goal.id}`}, ${TOGETHER_BONUS}, ${isoDay(goal.ends_on)}, ${`Group goal: ${goal.title}`})
            ON CONFLICT (user_id, key) DO NOTHING`;
      }
      await tx`UPDATE group_goals SET finalized_at = now() WHERE id = ${goal.id}`;
    });
  }
  return rewarded;
}

/**
 * Group podium: the top three groups (by average points per active member,
 * at least two active) for a finished Monday week or month — every member
 * gets the medal. Once per period.
 */
export async function finalizeGroupPodiums(sql: Sql, now = new Date()) {
  const todayUtc = now.toISOString().slice(0, 10);
  const cutoff = addDays(todayUtc, -4);
  const lastWeek = periodWeek(addDays(periodWeek(todayUtc, 1).from, -1), 1);
  const lastMonth = periodMonth(addDays(periodMonth(todayUtc).from, -1));
  const periods = [
    { key: `group:week:${lastWeek.from}`, kind: "week", start: lastWeek.from, ...lastWeek },
    { key: `group:month:${lastMonth.from.slice(0, 7)}`, kind: "month", start: lastMonth.from.slice(0, 7), ...lastMonth },
  ].filter((p) => p.to <= cutoff);
  let given = 0;
  for (const p of periods) {
    const [done] = await sql`SELECT 1 FROM podium_periods WHERE period = ${p.key}`;
    if (done) continue;
    const all = await sql<{ id: string; name: string }[]>`SELECT id, name FROM groups WHERE archived_at IS NULL`;
    const scored = (await Promise.all(all.map(async (g) => ({ ...g, ...(await groupPoints(sql, g.id, p.from, p.to)) })))).filter((g) => g.active >= 2);
    const awards: { user_id: string; badge_id: string }[] = [];
    for (const g of rankRows(scored).filter((r) => r.rank <= 3))
      for (const m of await memberIds(sql, g.id)) awards.push({ user_id: m, badge_id: `podium:group:${p.kind}:${p.start}:${g.rank}` });
    await sql.begin(async (tx) => {
      if (awards.length) await tx`INSERT INTO user_badges ${tx(awards, "user_id", "badge_id")} ON CONFLICT (user_id, badge_id) DO NOTHING`;
      await tx`INSERT INTO podium_periods (period) VALUES (${p.key}) ON CONFLICT DO NOTHING`;
    });
    given += awards.length;
  }
  return given;
}

