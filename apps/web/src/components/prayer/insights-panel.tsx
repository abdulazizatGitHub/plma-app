"use client";

import { markPrayer, prayerInsights, type Item } from "@life/shared";
import { Award, Clock4, Flame, Lightbulb, TrendingDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { SegmentedTabs, addDays, weekStart } from "@/components/kit";
import { shortDate } from "@/lib/v2/dates";
import { useActions, useItemOccurrences } from "@/lib/v2/use-day";

type Period = "week" | "month";
const MISSED_DAYS = 30;
const MISSED_SHOWN = 8;

function Tile({ label, value, tone }: { label: string; value: number; tone: "done" | "progress" | "todo" }) {
  const fill = { done: "bg-done", progress: "bg-progress", todo: "bg-todo" }[tone];
  return (
    <div className={`rounded-xl ${fill} px-3 py-2.5 text-on-fill`}>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-[12px]">{label}</p>
    </div>
  );
}

function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[13px] text-ink">
      <span className="mt-0.5 text-ink-2 [&>svg]:h-4 [&>svg]:w-4" aria-hidden>
        {icon}
      </span>
      <span>{children}</span>
    </p>
  );
}

/**
 * Prayer insights (PRY-07) and qada recovery (PRY-09) for the prayer block:
 * totals this week / month, rate per prayer, most consistent and most missed,
 * the on-time streak, a suggestion, and missed prayers to mark as qada.
 */
export function PrayerInsightsPanel({ group, prayers, today }: { group: Item; prayers: Item[]; today: string }) {
  const run = useActions();
  const [period, setPeriod] = useState<Period>("week");
  const [showAllMissed, setShowAllMissed] = useState(false);
  const from = period === "week" ? weekStart(today) : `${today.slice(0, 7)}-01`;
  const missedFrom = addDays(today, -(MISSED_DAYS - 1));
  const earliest = from < missedFrom ? from : missedFrom;
  const ids = useMemo(() => prayers.map((p) => p.id), [prayers]);
  const occs = useItemOccurrences(ids, earliest, today);
  const insights = useMemo(() => prayerInsights(group, prayers, occs, from, today, today), [group, prayers, occs, from, today]);
  const recent = useMemo(() => prayerInsights(group, prayers, occs, missedFrom, today, today), [group, prayers, occs, missedFrom, today]);
  const { totals, rows, mostMissed, mostConsistent, onTimeStreak, suggestion } = insights;
  const missed = recent.missedList;

  return (
    <section aria-label="Prayer insights" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink">Prayer insights</h2>
        <div className="w-52">
          <SegmentedTabs<Period>
            label="Period"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "week", label: "This week" },
              { value: "month", label: "This month" },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2" aria-label="Totals">
        <Tile label="On time" value={totals.prayed} tone="done" />
        <Tile label="Qada" value={totals.qada} tone="progress" />
        <Tile label="Missed" value={totals.missed} tone="todo" />
      </div>

      <div className="card space-y-2.5 p-3.5">
        <ul className="space-y-2" aria-label="Rate per prayer">
          {rows.map((r) => (
            <li key={r.itemId} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2 text-[13px]">
              <span className="truncate font-medium text-ink">{r.title}</span>
              <span className="relative h-2 overflow-hidden rounded-full bg-track" aria-hidden>
                <span className="absolute inset-y-0 left-0 rounded-full bg-progress" style={{ width: `${r.rate}%` }} />
                <span className="absolute inset-y-0 left-0 rounded-full bg-done" style={{ width: `${r.onTimeRate}%` }} />
              </span>
              <span className="text-right text-[12px] text-ink-2" aria-label={`${r.title}: ${r.prayed + r.qada} of ${r.due} prayed`}>
                {r.due ? `${r.prayed + r.qada}/${r.due}` : "—"}
              </span>
            </li>
          ))}
        </ul>
        <div className="space-y-1.5 border-t border-border pt-2.5">
          {mostConsistent && mostConsistent.due ? (
            <Fact icon={<Award />}>
              Most consistent: <b>{mostConsistent.title}</b> ({mostConsistent.onTimeRate}% on time)
            </Fact>
          ) : null}
          {mostMissed ? (
            <Fact icon={<TrendingDown />}>
              Most missed: <b>{mostMissed.title}</b> ({mostMissed.missed} missed)
            </Fact>
          ) : null}
          <Fact icon={<Flame />}>
            On-time streak: <b>{onTimeStreak} day{onTimeStreak === 1 ? "" : "s"}</b> <span className="text-ink-2">(qada doesn&apos;t extend it)</span>
          </Fact>
          <Fact icon={<Lightbulb />}>{suggestion}</Fact>
        </div>
      </div>

      <section aria-label="Missed prayers" className="card space-y-1 p-3.5">
        <h3 className="text-[14px] font-semibold text-ink">Missed prayers · last {MISSED_DAYS} days</h3>
        <p className="text-[12px] text-ink-2">Made one up? Mark it as qada — it then counts as prayed (late).</p>
        {missed.length ? (
          <ul className="mt-1 space-y-1">
            {(showAllMissed ? missed : missed.slice(0, MISSED_SHOWN)).map(({ date, entry }) => (
              <li key={`${date}|${entry.key}`} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-[13px] text-ink">
                  {entry.item.title} <span className="text-ink-2">· {shortDate(date)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void run((ctx) => markPrayer(entry, date, "qada", ctx))}
                  className="flex min-h-8 items-center gap-1 rounded-full bg-track px-3 text-[12px] font-medium text-ink hover:bg-border"
                >
                  <Clock4 className="h-3.5 w-3.5" aria-hidden /> Mark as qada
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-1 text-[13px] text-ink">None — every prayer is accounted for.</p>
        )}
        {!showAllMissed && missed.length > MISSED_SHOWN ? (
          <button type="button" onClick={() => setShowAllMissed(true)} className="min-h-8 text-[12px] font-medium text-link">
            Show all {missed.length}
          </button>
        ) : null}
      </section>
    </section>
  );
}
