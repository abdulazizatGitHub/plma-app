import { z } from "zod";
import { localDateSchema } from "./primitives.js";
import type { PublicPerson } from "./social.js";
import { dayEndsAt, AT_RISK_HOURS } from "./snaps.js";
import { periodMonth, periodWeek } from "./summary.js";

/*
 * Groups (Phase 9b, SOC-02/03/04, owner 2026-10-16): up to 50 members; owner
 * and admins invite. Group goals are "each member" (everyone reaches the
 * target) or "together" (the group adds up to it). Each member logs from
 * their own Today through a linked item. Members see each other's progress on
 * group goals — nothing else of theirs. Completers earn an award; a met
 * "together" goal adds +10 for each contributor. Groups also keep a streak:
 * days every member snapped the group.
 */

export const GROUP_MAX_MEMBERS = 50;
export const GROUP_MAX_GOALS = 10;
export const TOGETHER_BONUS = 10;
export const GROUP_ICONS = ["users", "home", "moon", "dumbbell", "book", "graduation", "heart", "star"] as const;
export type GroupIcon = (typeof GROUP_ICONS)[number];
export const GROUP_ROLES = ["owner", "admin", "member"] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

export const groupDraftSchema = z
  .object({
    name: z.string().trim().min(1, "Name the group").max(40, "40 characters at most"),
    icon: z.enum(GROUP_ICONS).default("users"),
    color: z.string().min(1).max(16).default("sky"),
    visibility: z.enum(["members", "everyone"]).default("members"),
  })
  .strict();
export type GroupDraft = z.infer<typeof groupDraftSchema>;

export const goalDraftSchema = z
  .object({
    title: z.string().trim().min(1, "Name the goal").max(60, "60 characters at most"),
    mode: z.enum(["each", "together"]),
    tracking: z.enum(["check", "quantity", "duration"]),
    unit: z.string().trim().min(1).max(24).optional(),
    target: z.number().positive().max(10_000_000),
    period: z.enum(["week", "month", "custom"]),
    from: localDateSchema.optional(),
    to: localDateSchema.optional(),
    reward: z.string().trim().max(80).optional(),
  })
  .strict()
  .refine((g) => g.tracking !== "quantity" || !!g.unit, { message: "Add a unit (e.g. steps)", path: ["unit"] })
  .refine((g) => g.period !== "custom" || (!!g.from && !!g.to && g.from <= g.to), { message: "Pick the start and end dates", path: ["to"] })
  .refine((g) => g.tracking !== "check" || Number.isInteger(g.target), { message: "Days must be a whole number", path: ["target"] });
export type GoalDraft = z.infer<typeof goalDraftSchema>;

/** The dates a goal runs (week and month start from the day it's set). */
export function goalRange(g: Pick<GoalDraft, "period" | "from" | "to">, today: string, weekStart: number): { from: string; to: string } {
  if (g.period === "custom") return { from: g.from!, to: g.to! };
  const p = g.period === "week" ? periodWeek(today, weekStart) : periodMonth(today);
  return { from: today > p.from ? today : p.from, to: p.to };
}

export type GoalEntry = { date: string; status: string; value: number | null };

/** A member's amount toward a goal: done days for ticks, else the sum of logged values. */
export function goalValue(tracking: GoalDraft["tracking"], entries: GoalEntry[], from: string, to: string): number {
  const inRange = entries.filter((e) => e.date >= from && e.date <= to);
  if (tracking === "check") return inRange.filter((e) => e.status === "done").length;
  return inRange.reduce((n, e) => n + (e.value ?? 0), 0);
}

export type GoalMember = PublicPerson & { value: number; met: boolean };
export type GoalView = {
  id: string;
  title: string;
  mode: "each" | "together";
  tracking: GoalDraft["tracking"];
  unit: string | null;
  target: number;
  from: string;
  to: string;
  reward: string | null;
  members: GoalMember[];
  /** Together: the group's sum. Each: members who met it. */
  total: number;
  met: boolean;
  daysLeft: number;
  finished: boolean;
};

/** Each: everyone at or above the target; together: the sum at or above it. */
export function goalStatus(mode: "each" | "together", target: number, values: number[]): { total: number; met: boolean } {
  if (mode === "together") {
    const total = values.reduce((n, v) => n + v, 0);
    return { total, met: total >= target };
  }
  const total = values.filter((v) => v >= target).length;
  return { total, met: values.length > 0 && total === values.length };
}

/** Group score (SOC-04): average points per active member (anyone with points). */
export function groupScore(points: number[]): { average: number; active: number } {
  const active = points.filter((p) => p > 0);
  return { average: active.length ? Math.round(active.reduce((n, p) => n + p, 0) / active.length) : 0, active: active.length };
}

export type GroupStreak = { count: number; best: number; todayDone: boolean; snappedToday: number; atRisk: boolean };

/**
 * Days every member (at least two) snapped the group. `days` maps a date to
 * who snapped; `members` is how many were in the group. Today never breaks it.
 */
export function groupStreak(days: Map<string, number>, members: number, today: string, now: Date, viewer: { timezone: string; dayEndHour: number }): GroupStreak {
  const full = (d: string) => members >= 2 && (days.get(d) ?? 0) >= members;
  const prev = (date: string) => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  };
  let count = 0;
  for (let d = full(today) ? today : prev(today); full(d); d = prev(d)) count += 1;
  let best = 0;
  let run = 0;
  let last: string | null = null;
  for (const d of [...days.keys()].filter(full).sort()) {
    run = last && prev(d) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = d;
  }
  const todayDone = full(today);
  const atRisk = count > 0 && !todayDone && dayEndsAt(today, viewer.timezone, viewer.dayEndHour).getTime() - now.getTime() <= AT_RISK_HOURS * 3_600_000;
  return { count, best: Math.max(best, count), todayDone, snappedToday: days.get(today) ?? 0, atRisk };
}

export type GroupSummary = {
  id: string;
  name: string;
  icon: GroupIcon;
  color: string;
  role: GroupRole;
  members: PublicPerson[];
  memberCount: number;
  streak: GroupStreak;
  /** The goal ending soonest, for the card. */
  goal: Pick<GoalView, "id" | "title" | "mode" | "target" | "total" | "met" | "unit"> | null;
};

export type GroupDetail = GroupSummary & {
  visibility: "members" | "everyone";
  roles: Record<string, GroupRole>;
  goals: GoalView[];
  /** Who snapped the group today. */
  snappedToday: PublicPerson[];
  inviteCode: string | null;
};

export type GroupInvite = { id: string; group: { id: string; name: string; icon: GroupIcon; color: string; memberCount: number }; from: PublicPerson; at: string };
export type GroupsPayload = { groups: GroupSummary[]; invites: GroupInvite[] };
export type GroupBoardRow = { id: string; name: string; icon: GroupIcon; color: string; average: number; active: number; rank: number; mine: boolean };
