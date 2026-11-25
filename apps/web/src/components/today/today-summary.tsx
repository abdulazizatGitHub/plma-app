"use client";

import type { DayAccess, DayProgress } from "@life/shared";
import { Check } from "lucide-react";
import { Ring } from "@/components/kit";

/**
 * The day at a glance (owner mockup, 2026-11-25): one ring with the %, then
 * "4 of 16 done" and a bar. The three rings, points and streak live on Progress.
 */
export function TodaySummary({ access, progress, fixUntil }: { access: DayAccess; progress: DayProgress; fixUntil?: string }) {
  const { done, required, pct } = progress;
  const complete = required > 0 && done >= required;
  const headline = access === "planned" ? (required ? `${required} planned` : "Nothing planned yet") : required ? `${done} of ${required} done` : "Nothing due";

  let note: string | null = null;
  if (access === "history") note = "This day is closed — its progress is final.";
  else if (access === "late") note = `You can still fix this day until ${fixUntil ?? "it closes"}.`;
  else if (access === "planned") note = "You can tick these when the day comes.";
  else if (!required) note = "A free day still counts as 100%.";
  else if (complete) note = "Everything's done — enjoy the rest of your day.";

  return (
    <section aria-label="Day summary" className="card flex items-center gap-4 p-4">
      <Ring label={`${pct}% of the day done`} value={access === "planned" ? 0 : pct} size={84} stroke={8}>
        {complete ? <Check className="h-7 w-7 text-primary-strong" strokeWidth={2.5} aria-hidden /> : <span className="text-[19px] font-semibold text-ink tabular-nums">{access === "planned" ? "–" : `${pct}%`}</span>}
      </Ring>
      <span aria-hidden className="w-px self-stretch bg-border" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-ink">{headline}</p>
        <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-track" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width] duration-(--duration-slow) ease-(--ease-standard)" style={{ width: `${access === "planned" ? 0 : pct}%` }} />
        </div>
        {note ? <p className="mt-2 text-[12px] leading-snug text-ink-2">{note}</p> : null}
      </div>
    </section>
  );
}
