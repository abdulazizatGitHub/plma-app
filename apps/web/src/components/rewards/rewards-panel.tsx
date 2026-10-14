"use client";

import { BADGES, PERFECT_DAY_BONUS, type BadgeDef, type BadgeId, type RewardsPayload } from "@life/shared";
import { Flag, Flame, Lock, Moon, Snowflake, Star, Trophy } from "lucide-react";
import { Ring } from "@/components/kit";

const fmt = (n: number) => n.toLocaleString("en-US");
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export const BADGE_ICON = { flame: Flame, moon: Moon, star: Star, flag: Flag } as const;
export const BADGE_TONE: Record<BadgeDef["icon"], string> = { flame: "var(--cat-peach)", moon: "var(--cat-lilac)", star: "var(--cat-yellow)", flag: "var(--cat-mint)" };

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

function hint(id: BadgeId, r: RewardsPayload): string {
  const p = r.progress.find((x) => x.id === id);
  if (p?.need !== undefined && p.have !== undefined) {
    const left = p.need - p.have;
    return `${left} more day${left === 1 ? "" : "s"}`;
  }
  return id === "first_plan" ? "Finish a plan" : "Not yet";
}

export function BadgeTile({ def, earnedAt, locked, sub }: { def: BadgeDef; earnedAt?: string; locked?: boolean; sub: string }) {
  const Icon = BADGE_ICON[def.icon];
  return (
    <li className={`flex flex-col items-center gap-1 rounded-[14px] p-2 text-center ${locked ? "opacity-60" : ""}`} aria-label={`${def.title}: ${locked || !earnedAt ? `locked, ${sub}` : `earned ${DAY.format(new Date(earnedAt))}`}`}>
      <span
        className={`relative inline-flex h-12 w-12 items-center justify-center rounded-full ${locked ? "bg-track text-ink-2" : "text-ink"}`}
        style={locked ? undefined : { background: BADGE_TONE[def.icon] }}
        aria-hidden
      >
        <Icon className="h-5.5 w-5.5" />
        {locked ? <Lock className="absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full bg-surface p-0.5 text-ink-2" /> : null}
      </span>
      <span className="text-[11.5px] leading-tight font-medium text-ink">{def.title}</span>
      <span className="text-[10.5px] leading-tight text-ink-2">{earnedAt ? DAY.format(new Date(earnedAt)) : sub}</span>
    </li>
  );
}

/** Progress → Rewards (REW-01…04): level, points, streak with freezes, badges. */
export function RewardsPanel({ rewards }: { rewards: RewardsPayload | null }) {
  if (!rewards) {
    return (
      <section aria-label="Rewards" className="card p-4 text-[13px] text-ink-2">
        Points, streaks and badges appear after your first sync.
      </section>
    );
  }
  const r = rewards;
  const span = r.nextLevelAt - r.levelStart;
  const into = r.points - r.levelStart;
  const note = streakNote(r);
  const earned = new Map(r.badges.map((b) => [b.id, b.earnedAt]));
  return (
    <section aria-label="Rewards" className="card space-y-3 p-4">
      <div className="flex items-center gap-4">
        <Ring label={`Level ${r.level}: ${fmt(into)} of ${fmt(span)} points to level ${r.level + 1}`} value={span ? (into / span) * 100 : 0} size={84} stroke={8}>
          <span className="flex flex-col items-center leading-tight">
            <span className="text-[10.5px] text-ink-2">Level</span>
            <span className="text-[22px] font-semibold text-ink">{r.level}</span>
          </span>
        </Ring>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-[18px] font-semibold text-ink tabular-nums">{fmt(r.points)} points</p>
          <p className="text-[12px] text-ink-2">
            {fmt(r.nextLevelAt - r.points)} to level {r.level + 1}
          </p>
          <p className="text-[12px] text-ink-2">
            This week <b className="text-ink">+{fmt(r.weekPoints)}</b> · today <b className="text-ink">+{fmt(r.todayPoints)}</b>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2.5 text-[12.5px] text-ink-2">
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
          Best <b className="text-ink">{r.streak.best}</b>
        </span>
      </div>
      {note ? <p className="text-[12.5px] text-ink">{note}</p> : null}

      <div>
        <h3 className="mb-1 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">Badges</h3>
        <ul className="grid grid-cols-4 gap-1 sm:grid-cols-7">
          {BADGES.map((def) => {
            const at = earned.get(def.id);
            return <BadgeTile key={def.id} def={def} earnedAt={at} locked={!at} sub={at ? "" : hint(def.id, r)} />;
          })}
        </ul>
      </div>

      <details className="text-[12px] text-ink-2">
        <summary className="cursor-pointer font-medium text-link">How points work</summary>
        <p className="mt-1">
          Each done item earns by priority: low 1, medium 2, high 3, critical 5. Qada prayers earn half. A perfect day (everything done on time) adds +{PERFECT_DAY_BONUS}. Fixes made after
          the day earn nothing, but still count in your history. Every 7 days in a row earns a freeze (up to 2), which covers a day you couldn&apos;t finish.
        </p>
      </details>
    </section>
  );
}

/** One quiet line for Today's card: "Level 4 · 1,240 pts · 5-day streak · 1 freeze". */
export function RewardsLine({ rewards }: { rewards: RewardsPayload }) {
  const r = rewards;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-2" aria-label="Rewards">
      <span className="flex items-center gap-1">
        <Star className="h-3.5 w-3.5 text-progress" aria-hidden />
        <span>
          Level <b className="text-ink">{r.level}</b> · <b className="text-ink">{fmt(r.points)}</b> pts
        </span>
      </span>
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
      {r.todayPoints ? <span>+{fmt(r.todayPoints)} today</span> : null}
    </p>
  );
}
