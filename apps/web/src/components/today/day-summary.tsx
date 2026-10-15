"use client";

import { RING_LABEL, RING_ORDER, type DayAccess, type DayEntry, type DayProgress, type DayRings, type DayStreak, type RewardsPayload } from "@life/shared";
import { Check, Flame, Lock, Sparkles, Trophy } from "lucide-react";
import { RingStack } from "@/components/kit";
import { RewardsLine } from "@/components/rewards/rewards-panel";
import { RING_BG, ringCount, ringNoun, ringsLabel, stackFromRings } from "@/lib/v2/rings";

type DaySummaryProps = {
  access: DayAccess;
  /** The day's rows (not the prayer block). */
  rows: DayEntry[];
  progress: DayProgress;
  /** The day's three rings (Prayer, Commitments, Balance). */
  rings: DayRings;
  date: string;
  today: string;
  streak: DayStreak;
  /** A late day (correction window): until when it can be fixed, e.g. "Thu, 12 AM". */
  fixUntil?: string;
  /** "Isha now · until 4:48 AM tomorrow" or "next: Asr at 3:59 PM" — what's now or next. */
  nextUp: string | null;
  /** Points, level and streak from the server (Today only); the local streak shows until they arrive. */
  rewards?: RewardsPayload | null;
  /** A ring that just closed (a soft pulse). */
  pulse?: string | null;
};

/**
 * The day at a glance (owner, 2026-10-12; rings 2026-10-15): three rings like
 * the Health app — Prayer, Commitments, Balance — with their counts, a
 * one-line summary, and points and streak underneath.
 */
export function DaySummaryCard({ access, progress, rings, streak, nextUp, fixUntil, rewards, pulse }: DaySummaryProps) {
  const closed = access === "history";
  const { done, required, pct } = progress;
  const left = Math.max(0, required - done);

  let summary: string;
  if (closed) summary = required ? `Day closed — ${done} of ${required} done.` : "Day closed — nothing was due.";
  else if (access === "late") summary = required ? `${done} of ${required} done · you can fix this day until ${fixUntil ?? "it closes"}.` : "Nothing was due that day.";
  else if (access === "planned") summary = required ? `${required} planned for this day.` : "Nothing planned yet.";
  else if (!required) summary = "Nothing due today — a free day still counts as 100%.";
  else if (rings.complete) summary = "Every ring closed — enjoy the rest of your day.";
  else summary = `${left} left${nextUp ? ` · ${nextUp}` : ""}`;

  return (
    <section aria-label="Day summary" className="card space-y-3 p-4">
      <div className="flex items-center gap-3.5">
        <RingStack label={`${pct}% of the day done · ${ringsLabel(rings)}`} value={pct} rings={stackFromRings(rings)} size={104} stroke={11} gap={2.5} pulse={pulse}>
          {closed ? <span className="text-[10.5px] font-medium text-ink-2">final</span> : rings.complete ? <Check className="h-6 w-6 text-done" aria-hidden /> : null}
        </RingStack>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {RING_ORDER.map((k) => {
            const r = rings[k];
            return (
              <li key={k} className="flex items-center gap-1.5 text-[13px]">
                <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${RING_BG[k]} ${r ? "" : "opacity-30"}`} />
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{RING_LABEL[k]}</span>
                <span className={`whitespace-nowrap tabular-nums ${r ? "text-ink" : "text-ink-2"}`}>
                  {ringCount(r)}
                  {r ? <span className="text-[11.5px] text-ink-2"> {ringNoun(k, r)}</span> : null}
                </span>
                {r?.closed ? <Check className="-ml-1 h-3.5 w-3.5 shrink-0 text-done" aria-label="closed" /> : null}
              </li>
            );
          })}
        </ul>
      </div>

      <p className="flex items-start gap-2 text-[13px] text-ink">
        <span className="mt-0.5 text-ink-2 [&>svg]:h-4 [&>svg]:w-4" aria-hidden>
          {closed ? <Lock /> : rings.complete ? <Trophy /> : <Sparkles />}
        </span>
        <span>{summary}</span>
      </p>

      {rewards ? (
        <div className="border-t border-border pt-2.5">
          <RewardsLine rewards={rewards} />
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2.5 text-[12px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-progress" aria-hidden />
            <span>
              <b className="text-ink">{streak.current}</b> perfect day{streak.current === 1 ? "" : "s"} in a row
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5" aria-hidden />
            Best <b className="text-ink">{streak.best}</b>
          </span>
        </div>
      )}
    </section>
  );
}
