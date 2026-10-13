"use client";

import { entryState, prayerDisplay, prayerMark, type DayAccess, type DayEntry, type DayProgress, type DayStreak, type DayPrayerTimes } from "@life/shared";
import { Flame, Lock, Sparkles, Trophy } from "lucide-react";
import { Ring, type RingSegment } from "@/components/kit";

type DaySummaryProps = {
  access: DayAccess;
  /** The day's rows (not the prayer block). */
  rows: DayEntry[];
  progress: DayProgress;
  /** The prayer block, if any (its own bar). */
  prayers: DayEntry | null;
  date: string;
  today: string;
  streak: DayStreak;
  /** A late day (correction window): until when it can be fixed, e.g. "Thu, 12 AM". */
  fixUntil?: string;
  /** For the prayers bar's now / not-marked-yet states (Today only). */
  now?: Date;
  times?: DayPrayerTimes | null;
  /** "Isha now · until 4:48 AM tomorrow" or "next: Asr at 3:59 PM" — what's now or next. */
  nextUp: string | null;
};

const ORDER: Record<RingSegment, number> = { done: 0, qada: 1, open: 2, missed: 3 };

/**
 * The day at a glance (owner, 2026-10-12): a large segmented ring (done /
 * in progress / left, or missed once the day is closed), the count and a
 * one-line summary, the prayers bar, and the perfect-day streak.
 */
export function DaySummaryCard({ access, rows, progress, prayers, date, today, streak, nextUp, now, times, fixUntil }: DaySummaryProps) {
  const closed = access === "history";
  // One arc per counted item, sorted so the ring fills: done, in progress, then the rest.
  const units = [...rows.flatMap((e) => (e.children ?? [e]).filter((u) => !u.item.isOptional)), ...(prayers?.children ?? [])];
  const segments: RingSegment[] = units
    .map((u): RingSegment => {
      const s = entryState(u);
      if (s === "not_today") return "open";
      if (s === "done") return "done";
      if (s === "in_progress") return "qada";
      return closed ? "missed" : "open";
    })
    .filter((_, i) => entryState(units[i]) !== "not_today")
    .sort((a, b) => ORDER[a] - ORDER[b]);
  const { done, required, pct } = progress;
  // The legend counts the same units as the ring, so it always adds up.
  const tally = { done: segments.filter((s) => s === "done").length, progress: segments.filter((s) => s === "qada").length };
  const rest = segments.length - tally.done - tally.progress;
  const left = Math.max(0, required - done);

  const prayerUnits = prayers?.children ?? [];
  const prayed = prayerUnits.filter((c) => {
    const m = prayerMark(c, date, today);
    return m === "prayed" || m === "qada";
  }).length;

  let summary: string;
  if (closed) summary = required ? `Day closed — ${done} of ${required} done.` : "Day closed — nothing was due.";
  else if (access === "late") summary = required ? `${done} of ${required} done · you can fix this day until ${fixUntil ?? "it closes"}.` : "Nothing was due that day.";
  else if (access === "planned") summary = required ? `${required} planned for this day.` : "Nothing planned yet.";
  else if (!required) summary = "Nothing due today — a free day still counts as 100%.";
  else if (pct === 100) summary = "Everything done — enjoy the rest of your day.";
  else summary = `${left} left${nextUp ? ` · ${nextUp}` : ""}`;

  return (
    <section aria-label="Day summary" className="card space-y-3 p-4">
      <div className="flex items-center gap-4">
        <Ring
          label={`${pct}% of the day done`}
          value={pct}
          segments={segments.length ? segments : undefined}
          size={112}
          stroke={10}
        >
          <span className="flex flex-col items-center leading-tight">
            <span className="text-[26px] font-semibold text-ink">{pct}%</span>
            <span className="text-[11px] text-ink-2">{closed ? "final" : "done"}</span>
          </span>
        </Ring>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[16px] font-semibold text-ink">{required ? `${done} of ${required} done` : "All clear"}</p>
          <ul className="space-y-0.5 text-[12px] text-ink-2">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-done" /> {tally.done} done
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-progress" /> {tally.progress} in progress
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${closed ? "bg-todo" : "bg-track"}`} /> {rest} {closed ? "missed" : "to do"}
            </li>
          </ul>
        </div>
      </div>

      <p className="flex items-start gap-2 text-[13px] text-ink">
        <span className="mt-0.5 text-ink-2 [&>svg]:h-4 [&>svg]:w-4" aria-hidden>
          {closed ? <Lock /> : pct === 100 && required ? <Trophy /> : <Sparkles />}
        </span>
        <span>{summary}</span>
      </p>

      {prayerUnits.length ? (
        <div className="space-y-1">
          <div className="flex justify-between text-[12px]">
            <span className="font-medium text-ink">Prayers</span>
            <span className="text-ink-2">
              {prayed}/{prayerUnits.length}
            </span>
          </div>
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Prayers: ${prayed} of ${prayerUnits.length} prayed`}>
            {prayerUnits.map((c) => {
              const d = now ? prayerDisplay(c, date, today, now, times ?? null) : prayerMark(c, date, today);
              // Not marked yet (time passed) is neutral, never qada or missed; "now" is outlined.
              const fill =
                d === "prayed" ? "bg-done" : d === "qada" ? "bg-progress" : d === "missed" ? "bg-todo" : d === "unmarked" ? "bg-track opacity-60" : "bg-track";
              return <span key={c.key} title={c.item.title} className={`flex-1 ${fill} ${d === "now" ? "outline-2 -outline-offset-2 outline-primary-strong" : ""}`} />;
            })}
          </div>
        </div>
      ) : null}

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
    </section>
  );
}
