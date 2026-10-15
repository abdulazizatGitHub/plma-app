"use client";

import { PERFECT_DAY_BONUS, RING_LABEL, awardDef, challengeText, type AwardDef, type AwardIcon, type AwardProgress, type RewardsPayload } from "@life/shared";
import { CalendarCheck, ChevronRight, Flag, Flame, Lock, Medal, Moon, Snowflake, Star, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { RING_BG } from "@/lib/v2/rings";

const fmt = (n: number) => n.toLocaleString("en-US");
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export const AWARD_ICON: Record<AwardIcon, typeof Flame> = { flame: Flame, moon: Moon, star: Star, flag: Flag, target: Target, medal: Medal, calendar: CalendarCheck };
/** Category pastels only (owner: never invent colours). */
export const AWARD_TONE: Record<AwardIcon, string> = {
  flame: "var(--cat-peach)",
  moon: "var(--cat-lilac)",
  star: "var(--cat-yellow)",
  flag: "var(--cat-mint)",
  target: "var(--cat-sky)",
  medal: "var(--cat-teal)",
  calendar: "var(--cat-pink)",
};

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** A gentle line about the streak: a freeze that just helped, or a fresh start (never "you lost it"). */
export function streakNote(r: RewardsPayload): string | null {
  const recent = addDays(r.today, -7);
  const froze = r.streak.freezeUsedOn.at(-1);
  if (froze && froze >= recent) return `A freeze covered ${DAY.format(new Date(`${froze}T12:00:00`))} — your ${r.streak.current}-day streak keeps going.`;
  const restarted = r.streak.restartedAfter.at(-1);
  if (restarted && restarted >= recent && r.streak.current < r.streak.best) {
    return r.streak.current ? `New streak under way — your best is still ${r.streak.best}.` : `A new streak starts today — your best is still ${r.streak.best}.`;
  }
  return null;
}

const DAY_COUNTS = new Set(["streaks", "challenges", "seasonal"]);

/** "3 more days", "63 of 100", "Finish a plan". */
export function awardHint(p: AwardProgress | undefined, def: AwardDef): string {
  if (p?.need !== undefined && p.have !== undefined) {
    if (DAY_COUNTS.has(def.group) || def.id === "prayers_week") {
      const left = p.need - p.have;
      return left <= 0 ? "Final soon" : `${left} more day${left === 1 ? "" : "s"}`;
    }
    return `${fmt(p.have)} of ${fmt(p.need)}`;
  }
  return def.id === "first_plan" ? "Finish a plan" : "Not yet";
}

export function AwardTile({ def, earnedAt, hint }: { def: AwardDef; earnedAt?: string; hint: string }) {
  const Icon = AWARD_ICON[def.icon];
  const locked = !earnedAt;
  return (
    <li
      className={`flex flex-col items-center gap-1 rounded-[14px] p-2 text-center ${locked ? "opacity-60" : ""}`}
      aria-label={`${def.title}: ${locked ? `locked, ${hint}` : `earned ${DAY.format(new Date(earnedAt))}`}`}
    >
      <span
        className={`relative inline-flex h-12 w-12 items-center justify-center rounded-full ${locked ? "bg-track text-ink-2" : "text-ink"}`}
        style={locked ? undefined : { background: AWARD_TONE[def.icon] }}
        aria-hidden
      >
        <Icon className="h-5.5 w-5.5" />
        {locked ? <Lock className="absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full bg-surface p-0.5 text-ink-2" /> : null}
      </span>
      <span className="text-[11.5px] leading-tight font-medium text-ink">{def.title}</span>
      <span className="text-[10.5px] leading-tight text-ink-2">{earnedAt ? DAY.format(new Date(earnedAt)) : hint}</span>
    </li>
  );
}

/** Awards to show first: in season, then the newest earned, then the closest locked. */
export function featuredAwards(r: RewardsPayload, count = 4) {
  const earned = new Map(r.badges.map((b) => [b.id, b.earnedAt]));
  const live = r.awards.filter((a) => a.live && !earned.has(a.id)).map((a) => a.id);
  const recent = [...r.badges].reverse().map((b) => b.id);
  const close = r.awards
    .filter((a) => !a.earned && !a.live && a.need && a.have !== undefined)
    .sort((a, b) => b.have! / b.need! - a.have! / a.need!)
    .map((a) => a.id);
  const ids = [...new Set([...live, ...recent, ...close])].slice(0, count);
  return ids.flatMap((id) => {
    const def = awardDef(id);
    return def ? [{ def, earnedAt: earned.get(id), progress: r.awards.find((a) => a.id === id) }] : [];
  });
}

/** Progress → rings and awards (REW-01…04, Phase 8.1): challenge, streak, awards, then points. */
export function RewardsPanel({ rewards }: { rewards: RewardsPayload | null }) {
  if (!rewards) {
    return (
      <section aria-label="Rewards" className="card p-4 text-[13px] text-ink-2">
        Streaks and awards appear after your first sync.
      </section>
    );
  }
  const r = rewards;
  const note = streakNote(r);
  const c = r.challenge;
  const featured = featuredAwards(r);
  return (
    <section aria-label="Rewards" className="card space-y-3 p-4">
      {c ? (
        <div className="space-y-1.5" aria-label="Monthly challenge">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 shrink-0 text-link" aria-hidden />
            <p className="flex-1 text-[13.5px] font-medium text-ink">{challengeText(c)}</p>
            <span className="text-[13px] font-semibold text-ink tabular-nums">
              {Math.min(c.closed, c.target)}/{c.target}
            </span>
          </div>
          <span className="block h-1.5 overflow-hidden rounded-full bg-track">
            <span className={`block h-full rounded-full ${RING_BG[c.ring]}`} style={{ width: `${Math.min(100, (c.closed / c.target) * 100)}%` }} />
          </span>
          <p className="text-[11.5px] text-ink-2">
            {c.closed >= c.target
              ? "Done — the award arrives once the days are final."
              : `${c.target - c.closed} more ${RING_LABEL[c.ring]} ring${c.target - c.closed === 1 ? "" : "s"} · ${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left`}
          </p>
        </div>
      ) : null}

      <div className={`flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2 ${c ? "border-t border-border pt-2.5" : ""}`}>
        <span className="flex items-center gap-1.5">
          <Flame className="h-4 w-4 text-progress" aria-hidden />
          <span>
            <b className="text-ink">{r.streak.current}</b>-day streak
          </span>
        </span>
        <span className="flex items-center gap-1.5" title="A freeze covers a day you couldn't finish. Earn one every 7 days in a row (hold up to 2).">
          <Snowflake className="h-4 w-4 text-link" aria-hidden />
          <span>
            <b className="text-ink">{r.streak.freezes}</b> freeze{r.streak.freezes === 1 ? "" : "s"}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <Trophy className="h-4 w-4" aria-hidden />
          <span>
            Best <b className="text-ink">{r.streak.best}</b>
          </span>
        </span>
      </div>
      {note ? <p className="text-[12.5px] text-ink">{note}</p> : null}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[12px] font-semibold tracking-wide text-ink-2 uppercase">Awards</h3>
          <Link href="/progress/awards" className="inline-flex min-h-8 items-center gap-0.5 rounded-full px-2 text-[12.5px] font-medium text-link hover:bg-track">
            All awards <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        <ul className="grid grid-cols-4 gap-1">
          {featured.map(({ def, earnedAt, progress }) => (
            <AwardTile key={def.id} def={def} earnedAt={earnedAt} hint={awardHint(progress, def)} />
          ))}
        </ul>
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2.5 text-[12px] text-ink-2">
        <span className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-progress" aria-hidden />
          <span>
            Level <b className="text-ink">{r.level}</b> · <b className="text-ink">{fmt(r.points)}</b> pts · {fmt(r.nextLevelAt - r.points)} to level {r.level + 1}
          </span>
        </span>
        <span>
          This week <b className="text-ink">+{fmt(r.weekPoints)}</b>
        </span>
      </p>

      <details className="text-[12px] text-ink-2">
        <summary className="cursor-pointer font-medium text-link">How rings and points work</summary>
        <div className="mt-1 space-y-1">
          <p>
            <b className="text-ink">Prayer</b> closes when all five are prayed (qada fills half, and still counts). <b className="text-ink">Commitments</b> closes when
            everything due is done. <b className="text-ink">Balance</b> closes when every area with something due gets at least one thing done. Close every ring
            that applies for a complete day — that keeps your streak going.
          </p>
          <p>
            Points: low 1, medium 2, high 3, critical 5; qada earns half. A perfect day (complete, nothing fixed late) adds +{PERFECT_DAY_BONUS}. Fixes made after
            the day earn nothing but still count in your history. Every 7 days in a row earns a freeze (up to 2).
          </p>
        </div>
      </details>
    </section>
  );
}

/** One quiet line for Today's card: "5-day streak · 1 freeze · Level 4 · 1,240 pts". */
export function RewardsLine({ rewards }: { rewards: RewardsPayload }) {
  const r = rewards;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-2" aria-label="Rewards">
      <span className="flex items-center gap-1">
        <Flame className="h-3.5 w-3.5 text-progress" aria-hidden />
        <span>
          <b className="text-ink">{r.streak.current}</b>-day streak
        </span>
      </span>
      {r.streak.freezes ? (
        <span className="flex items-center gap-1">
          <Snowflake className="h-3.5 w-3.5 text-link" aria-hidden />
          <span>
            <b className="text-ink">{r.streak.freezes}</b> freeze{r.streak.freezes === 1 ? "" : "s"}
          </span>
        </span>
      ) : null}
      <span className="flex items-center gap-1">
        <Star className="h-3.5 w-3.5" aria-hidden />
        <span>
          Level {r.level} · {fmt(r.points)} pts{r.todayPoints ? ` · +${fmt(r.todayPoints)} today` : ""}
        </span>
      </span>
    </p>
  );
}
