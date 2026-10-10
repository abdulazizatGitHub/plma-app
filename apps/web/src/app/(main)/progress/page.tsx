"use client";

import { todayLocalDate } from "@life/shared";
import { useEffect, useMemo, useState } from "react";
import { Bars, Ring, addDays } from "@/components/kit";
import { useDays } from "@/lib/v2/use-day";

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "narrow" });

/** Today's ring and the last 7 days. Full history and analytics arrive in v2 Phase 7. */
export default function ProgressPage() {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(todayLocalDate()), []); // eslint-disable-line react-hooks/set-state-in-effect -- client-only date
  const dates = useMemo(() => (today ? Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)) : []), [today]);
  const days = useDays(dates);
  const pcts = dates.map((d) => days.get(d)?.progress.pct ?? 0);
  const todayPct = pcts.at(-1) ?? 0;
  const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;

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
    </div>
  );
}
