import { dateRange } from "./history.js";
import type { RingKind } from "./rings.js";
import { RING_LABEL } from "./rings.js";
import { levelOf, streakOf, type RewardDay } from "./rewards.js";
import { periodMonth, periodWeek } from "./summary.js";

/*
 * Awards (Phase 8.1, owner 2026-10-15), like the Health app's: streaks, rings,
 * lifetime milestones, a personal monthly challenge, and seasonal awards on
 * the Hijri calendar. Each is a pure check over closed days and is awarded
 * once. All free — premium (later) is extras, never rewards.
 */

export type AwardGroup = "streaks" | "rings" | "milestones" | "challenges" | "seasonal" | "leaderboards" | "plans";
export type AwardIcon = "flame" | "moon" | "star" | "flag" | "target" | "medal" | "calendar";

export type AwardDef = { id: string; group: AwardGroup; title: string; description: string; icon: AwardIcon };

export const AWARD_GROUPS: { id: AwardGroup; title: string }[] = [
  { id: "streaks", title: "Streaks" },
  { id: "rings", title: "Rings" },
  { id: "challenges", title: "Monthly challenges" },
  { id: "seasonal", title: "Seasonal" },
  { id: "milestones", title: "Milestones" },
  { id: "leaderboards", title: "Leaderboards" },
  { id: "plans", title: "Plans" },
];

const fmtN = (n: number) => n.toLocaleString("en-US");

export const STATIC_AWARDS: AwardDef[] = [
  { id: "streak_3", group: "streaks", title: "3-day streak", description: "Three complete days in a row.", icon: "flame" },
  { id: "streak_7", group: "streaks", title: "7-day streak", description: "You kept it going a whole week.", icon: "flame" },
  { id: "streak_30", group: "streaks", title: "30-day streak", description: "A month of complete days.", icon: "flame" },
  { id: "streak_100", group: "streaks", title: "100-day streak", description: "A hundred complete days.", icon: "flame" },
  ...[7, 30, 100].map((n): AwardDef => ({ id: `friend_streak_${n}`, group: "streaks", title: `${n}-day friend streak`, description: `Snapped back and forth with a friend ${n} days running.`, icon: "flame" })),
  { id: "prayers_week", group: "rings", title: "A week of prayers", description: "Prayer ring closed seven days running.", icon: "moon" },
  { id: "perfect_week", group: "rings", title: "Perfect week", description: "Every day of a week perfect (at least 5 with something due).", icon: "star" },
  { id: "perfect_month", group: "rings", title: "Perfect month", description: "Every ring closed on every day of a month (at least 20 with something due).", icon: "star" },
  { id: "jumuah_4", group: "seasonal", title: "Four Jumu'ahs", description: "Jumu'ah prayed four Fridays in a row.", icon: "moon" },
  ...[100, 500, 1000].map((n): AwardDef => ({ id: `prayers_${n}`, group: "milestones", title: `${fmtN(n)} prayers`, description: `${fmtN(n)} prayers prayed on time.`, icon: "medal" })),
  ...[100, 1000].map((n): AwardDef => ({ id: `items_${n}`, group: "milestones", title: `${fmtN(n)} done`, description: `${fmtN(n)} things done.`, icon: "medal" })),
  ...[5, 10, 20].map((n): AwardDef => ({ id: `level_${n}`, group: "milestones", title: `Level ${n}`, description: `Reached level ${n}.`, icon: "medal" })),
  { id: "first_plan", group: "plans", title: "First plan finished", description: "Every step of a plan done.", icon: "flag" },
];

const MONTH_NAME = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** An award's definition, including dynamic ones (`challenge:2026-10`, `ramadan:1448`). Null for unknown ids. */
export function awardDef(id: string): AwardDef | null {
  const fixed = STATIC_AWARDS.find((a) => a.id === id);
  if (fixed) return fixed;
  const [kind, arg] = id.split(":");
  if (kind === "challenge" && /^\d{4}-\d{2}$/.test(arg ?? "")) {
    return { id, group: "challenges", title: `${MONTH_NAME.format(new Date(`${arg}-15T12:00:00Z`))} challenge`, description: "Your personal goal for the month, met.", icon: "target" };
  }
  if (kind === "podium") {
    // podium:<global|friends>:<week|month>:<period start>:<1|2|3> (Phase 9a)
    const [, board, period, start, place] = id.split(":");
    const n = Number(place);
    if ((board === "global" || board === "friends") && (period === "week" || period === "month") && /^\d{4}-\d{2}(-\d{2})?$/.test(start ?? "") && n >= 1 && n <= 3) {
      const medal = ["Gold", "Silver", "Bronze"][n - 1];
      const when =
        period === "week"
          ? `week of ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${start}T12:00:00Z`))}`
          : MONTH_NAME.format(new Date(`${start.slice(0, 7)}-15T12:00:00Z`));
      return {
        id,
        group: "leaderboards",
        title: `${medal} · ${board === "global" ? "everyone" : "friends"}`,
        description: `${["1st", "2nd", "3rd"][n - 1]} place on the ${board === "global" ? "Everyone" : "Friends"} board, ${when}.`,
        icon: "medal",
      };
    }
    return null;
  }
  if (kind === "ramadan" && /^\d+$/.test(arg ?? "")) return { id, group: "seasonal", title: `Ramadan ${arg}`, description: "Prayer ring closed every day of Ramadan.", icon: "moon" };
  if (kind === "dhul_hijjah" && /^\d+$/.test(arg ?? "")) {
    return { id, group: "seasonal", title: `Dhul Hijjah ${arg}`, description: "Every ring closed on the first ten days of Dhul Hijjah.", icon: "calendar" };
  }
  return null;
}

/* ---------- Hijri calendar ---------- */

export type HijriDate = { year: number; month: number; day: number };
export const HIJRI_MONTHS = ["Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani", "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qa'dah", "Dhul Hijjah"];
const HIJRI = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
const shift = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/**
 * The Hijri date for a calendar day (Umm al-Qura), moved by the user's
 * adjustment: −1 where the month starts a day later than in Makkah (often Pakistan).
 */
export function hijriDate(date: string, offset = 0): HijriDate {
  const parts = HIJRI.formatToParts(new Date(`${shift(date, offset)}T12:00:00Z`));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { year: n("year"), month: n("month"), day: n("day") };
}

export const hijriLabel = (h: HijriDate) => `${h.day} ${HIJRI_MONTHS[h.month - 1] ?? ""} ${h.year}`;

/* ---------- monthly challenge ---------- */

export type Challenge = { month: string; ring: RingKind; target: number };

export const ringClosed = (d: RewardDay, ring: RingKind) => (ring === "prayer" ? d.prayerClosed : ring === "commit" ? d.commitClosed : d.balanceClosed) === true;
const ringApplies = (d: RewardDay, ring: RingKind) => (ring === "prayer" ? d.prayerDue : ring === "commit" ? d.commitDue : d.balanceDue) > 0;

/**
 * This month's personal challenge, set once from last month: the ring with the
 * most room to grow, a little above what was managed (owner, 2026-10-15).
 */
export function makeChallenge(month: string, lastMonth: RewardDay[]): Challenge {
  const { to } = periodMonth(`${month}-01`);
  const days = Number(to.slice(8));
  const rings: RingKind[] = ["prayer", "commit", "balance"];
  const scored = rings
    .map((ring) => {
      const applied = lastMonth.filter((d) => ringApplies(d, ring));
      const closed = applied.filter((d) => ringClosed(d, ring)).length;
      return { ring, applied: applied.length, closed, share: applied.length ? closed / applied.length : 1 };
    })
    .filter((r) => r.applied >= 7);
  if (!scored.length) return { month, ring: "commit", target: 12 };
  const pick = [...scored].sort((a, b) => a.share - b.share || b.applied - a.applied)[0];
  const target = Math.max(8, Math.min(days - 2, Math.round(pick.closed * 1.1) + 1));
  return { month, ring: pick.ring, target };
}

export function challengeText(c: Challenge) {
  return `Close your ${RING_LABEL[c.ring]} ring ${c.target} days in ${MONTH_NAME.format(new Date(`${c.month}-15T12:00:00Z`)).split(" ")[0]}`;
}

/* ---------- evaluation ---------- */

export type AwardProgress = {
  id: string;
  earned: boolean;
  have?: number;
  need?: number;
  /** In season now (Ramadan, the first ten of Dhul Hijjah, this month's challenge). */
  live?: boolean;
};

export type AwardInput = {
  days: RewardDay[];
  closedThrough: string | null;
  today: string;
  weekStart: number;
  plansFinished: number;
  hijriOffset: number;
  challenges: Challenge[];
  /** Best snap streak with any friend (Phase 9a+). */
  friendStreakBest?: number;
};

export function evaluateAwards(input: AwardInput): AwardProgress[] {
  const { closedThrough, today, weekStart, hijriOffset } = input;
  const all = [...input.days].sort((a, b) => a.date.localeCompare(b.date));
  const isClosed = (date: string) => !!closedThrough && date <= closedThrough;
  const closed = all.filter((d) => isClosed(d.date));
  const byDate = new Map(all.map((d) => [d.date, d]));
  const out: AwardProgress[] = [];

  // Streaks: closed days only.
  const s = streakOf(closed, closedThrough, closedThrough ?? "");
  const live = streakOf(all, closedThrough, today);
  for (const need of [3, 7, 30, 100]) out.push({ id: `streak_${need}`, earned: s.best >= need, have: Math.min(live.current, need), need });

  // Rings.
  let run = 0;
  let best = 0;
  for (const d of closed) {
    if (!d.prayerDue) continue;
    run = d.prayerClosed ? run + 1 : 0;
    best = Math.max(best, run);
  }
  out.push({ id: "prayers_week", earned: best >= 7, have: Math.min(run, 7), need: 7 });

  const groups = (key: (date: string) => string) => {
    const m = new Map<string, RewardDay[]>();
    for (const d of closed) m.set(key(d.date), [...(m.get(key(d.date)) ?? []), d]);
    return m;
  };
  const perfectWeek = [...groups((d) => periodWeek(d, weekStart).from).entries()].some(([from, ds]) => {
    if (!isClosed(periodWeek(from, weekStart).to)) return false;
    const due = ds.filter((d) => d.due > 0);
    return due.length >= 5 && due.every((d) => d.perfect);
  });
  out.push({ id: "perfect_week", earned: perfectWeek });
  const perfectMonth = [...groups((d) => d.slice(0, 7)).entries()].some(([month, ds]) => {
    if (!isClosed(periodMonth(`${month}-01`).to)) return false;
    const due = ds.filter((d) => d.due > 0);
    return due.length >= 20 && due.every((d) => d.complete);
  });
  out.push({ id: "perfect_month", earned: perfectMonth });

  // Jumu'ah: Zuhr prayed (on time or qada) four Fridays running.
  let fridays = 0;
  let bestFridays = 0;
  for (const d of closed) {
    if (new Date(`${d.date}T12:00:00Z`).getUTCDay() !== 5 || d.dhuhr === null) continue;
    fridays = d.dhuhr ? fridays + 1 : 0;
    bestFridays = Math.max(bestFridays, fridays);
  }
  out.push({ id: "jumuah_4", earned: bestFridays >= 4, have: Math.min(fridays, 4), need: 4 });

  // Milestones: closed days count; progress shows everything so far.
  const sum = (ds: RewardDay[], f: (d: RewardDay) => number) => ds.reduce((n, d) => n + f(d), 0);
  const prayersClosed = sum(closed, (d) => d.prayersOnTime);
  const prayersAll = sum(all, (d) => d.prayersOnTime);
  for (const need of [100, 500, 1000]) out.push({ id: `prayers_${need}`, earned: prayersClosed >= need, have: Math.min(prayersAll, need), need });
  const itemsClosed = sum(closed, (d) => d.itemsDone);
  const itemsAll = sum(all, (d) => d.itemsDone);
  for (const need of [100, 1000]) out.push({ id: `items_${need}`, earned: itemsClosed >= need, have: Math.min(itemsAll, need), need });
  const levelClosed = levelOf(sum(closed, (d) => d.points)).level;
  const levelAll = levelOf(sum(all, (d) => d.points)).level;
  for (const need of [5, 10, 20]) out.push({ id: `level_${need}`, earned: levelClosed >= need, have: Math.min(levelAll, need), need });

  out.push({ id: "first_plan", earned: input.plansFinished > 0 });
  for (const need of [7, 30, 100]) out.push({ id: `friend_streak_${need}`, earned: (input.friendStreakBest ?? 0) >= need, have: Math.min(input.friendStreakBest ?? 0, need), need });

  // Monthly challenges.
  const thisMonth = today.slice(0, 7);
  for (const c of input.challenges) {
    const inMonth = all.filter((d) => d.date.startsWith(c.month));
    const closedCount = inMonth.filter((d) => isClosed(d.date) && ringClosed(d, c.ring)).length;
    const soFar = inMonth.filter((d) => ringClosed(d, c.ring)).length;
    if (c.month !== thisMonth && closedCount < c.target && isClosed(periodMonth(`${c.month}-01`).to)) continue; // missed: not listed
    out.push({ id: `challenge:${c.month}`, earned: closedCount >= c.target, have: Math.min(soFar, c.target), need: c.target, live: c.month === thisMonth });
  }

  // Seasonal (Hijri): Ramadan — Prayer ring every day; Dhul Hijjah — every ring on days 1–10.
  if (all.length) {
    const seasons = new Map<string, { dates: string[]; year: number; month: number }>();
    for (const date of dateRange(all[0].date, shift(today, 30))) {
      const h = hijriDate(date, hijriOffset);
      if (h.month !== 9 && !(h.month === 12 && h.day <= 10)) continue;
      const key = `${h.month === 9 ? "ramadan" : "dhul_hijjah"}:${h.year}`;
      const sn = seasons.get(key) ?? { dates: [], year: h.year, month: h.month };
      if (!sn.dates.length && h.day !== 1) continue; // started before history: can't be judged
      sn.dates.push(date);
      seasons.set(key, sn);
    }
    for (const [id, sn] of seasons) {
      const started = sn.dates[0] <= today;
      if (!started) continue;
      const ok = (date: string) => {
        const d = byDate.get(date);
        return !!d && (sn.month === 9 ? d.prayerClosed : d.complete);
      };
      const finished = isClosed(sn.dates.at(-1)!);
      const earned = finished && sn.dates.every(ok);
      const inSeason = today >= sn.dates[0] && today <= sn.dates.at(-1)!;
      if (!earned && !inSeason) continue; // only in season, or once earned
      out.push({ id, earned, have: sn.dates.filter((d) => d <= today && ok(d)).length, need: sn.dates.length, live: inSeason });
    }
  }
  return out;
}
