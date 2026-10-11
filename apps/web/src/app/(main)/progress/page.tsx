"use client";

import { prayerInsights } from "@life/shared";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Bars, Ring, addDays, weekStart } from "@/components/kit";
import { useDays, useItemOccurrences, usePrayerSet } from "@/lib/v2/use-day";
import { useToday } from "@/lib/v2/use-today";

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "narrow" });

/** Today's ring and the last 7 days. Full history and analytics arrive in v2 Phase 7. */
export default function ProgressPage() {
  const today = useToday();
  const dates = useMemo(() => (today ? Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)) : []), [today]);
  const days = useDays(dates);
  const pcts = dates.map((d) => days.get(d)?.progress.pct ?? 0);
  const todayPct = pcts.at(-1) ?? 0;
  const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
  const { group, prayers } = usePrayerSet();
  const from = today ? weekStart(today) : "1970-01-01";
  const prayerIds = useMemo(() => prayers.map((p) => p.id), [prayers]);
  const prayerOccs = useItemOccurrences(prayerIds, from, today ?? from);
  const week = useMemo(() => (group && today ? prayerInsights(group, prayers, prayerOccs, from, today, today) : null), [group, prayers, prayerOccs, from, today]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Progress</h1>
        <p className="text-[13px] text-ink-2">Skipped and moved items don&apos;t count against you.</p>
      </header>
      <section className="card flex items-center gap-5 p-5">
        <Ring label={`${todayPct}% of today done`} value={todayPct} size={96} stroke={9}>
          <span className="text-xl font-semibold text-ink">{todayPct}%</span>
        </Ring>
        <div>
          <p className="text-[15px] font-medium text-ink">Today</p>
          <p className="text-[13px] text-ink-2">7-day average {avg}%</p>
        </div>
      </section>
      <section className="card p-5">
        <h2 className="mb-4 text-[15px] font-medium text-ink">Last 7 days</h2>
        <Bars
          label={`Daily progress, last 7 days: ${pcts.join("%, ")}%`}
          values={pcts}
          max={100}
          labels={dates.map((d) => WEEKDAY.format(new Date(`${d}T12:00:00`)))}
          highlight={6}
        />
      </section>
      {group && week ? (
        <Link href={`/items/view?id=${group.id}`} aria-label="Prayers this week" className="card flex items-center gap-4 p-5">
          <Ring label={`${week.totals.prayed + week.totals.qada} of ${week.totals.due} prayers this week`} value={week.totals.due ? ((week.totals.prayed + week.totals.qada) / week.totals.due) * 100 : 0} size={56} stroke={6} />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-ink">Prayers this week</span>
            <span className="block text-[13px] text-ink-2">
              {week.totals.prayed} on time · {week.totals.qada} qada · {week.totals.missed} missed
              {week.mostMissed ? ` · most missed: ${week.mostMissed.title}` : ""}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-ink-2" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
