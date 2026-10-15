"use client";

import { prayerInsights, type CategoryTally, type SummaryDay } from "@life/shared";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Flame, Sparkles, Trophy, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { createElement, useMemo, useState } from "react";
import { Heatmap, Ring, RingStack, SegmentedTabs, type HeatMark } from "@/components/kit";
import { categoryIcon, categoryTone } from "@/lib/v2/category-style";
import { SyncingNote } from "@/components/history/syncing-note";
import { RewardsPanel } from "@/components/rewards/rewards-panel";
import { useRewards } from "@/lib/v2/use-rewards";
import { useDayStreak, useHasSynced, useItemOccurrences, usePrayerSet, useUserSettings } from "@/lib/v2/use-day";
import { usePeriodRings, usePeriodSummary, type PeriodKind } from "@/lib/v2/use-history";
import { ringsLabel, stackFromRings } from "@/lib/v2/rings";
import { useToday } from "@/lib/v2/use-today";

const KEY = "life_progress_period";
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "narrow", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const utc = (d: string) => new Date(`${d}T12:00:00Z`);
const shift = (d: string, days: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + days)).toISOString().slice(0, 10);
};

function heatMark(d: SummaryDay): HeatMark {
  if (d.kind === "future") return "future";
  if (d.kind === "today") return "today";
  if (d.pct === null) return "not_due";
  return d.pct === 100 ? "done" : d.pct > 0 ? "partial" : "missed";
}

/** Week and month history (HIS-02/03, owner 2026-10-13): averages of finished days, trend, categories, insights. */
export default function ProgressPage() {
  const today = useToday();
  if (!today) return <div className="skeleton h-40" aria-busy="true" aria-label="Loading progress" />;
  return <Progress today={today} />;
}

function Progress({ today }: { today: string }) {
  const [kind, setKindState] = useState<PeriodKind>(() => {
    try {
      return localStorage.getItem(KEY) === "month" ? "month" : "week";
    } catch {
      return "week";
    }
  });
  const [anchor, setAnchor] = useState(today);
  const setKind = (k: PeriodKind) => {
    setKindState(k);
    setAnchor(today);
    try {
      localStorage.setItem(KEY, k);
    } catch {
      /* fine */
    }
  };
  const { current, previous } = usePeriodSummary(kind, anchor, today);
  const dayRings = usePeriodRings(current.from, current.to, today);
  const streak = useDayStreak(today);
  const synced = useHasSynced();
  const { rewards } = useRewards();
  const { weekStart } = useUserSettings();
  const isCurrent = current.from <= today && today <= current.to;
  const label = isCurrent
    ? kind === "week"
      ? "This week"
      : "This month"
    : kind === "week"
      ? `${DAY.format(utc(current.from))} – ${DAY.format(utc(current.to))}`
      : MONTH.format(utc(current.from));
  const step = (dir: -1 | 1) => setAnchor(kind === "week" ? shift(current.from, dir * 7) : shift(dir < 0 ? current.from : current.to, dir));
  const trend = current.average !== null && previous.average !== null ? current.average - previous.average : null;

  // Prayers in the same period.
  const { group, prayers } = usePrayerSet();
  const prayerIds = useMemo(() => prayers.map((p) => p.id), [prayers]);
  const pTo = current.to < today ? current.to : today;
  const prayerOccs = useItemOccurrences(prayerIds, current.from, pTo);
  const prayerStats = useMemo(() => (group && current.from <= today ? prayerInsights(group, prayers, prayerOccs, current.from, pTo, today) : null), [group, prayers, prayerOccs, current.from, pTo, today]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Progress</h1>
        <p className="text-[13px] text-ink-2">Finished days only — skipped and moved items don&apos;t count against you.</p>
      </header>
      {synced === false ? <SyncingNote /> : null}
      <RewardsPanel rewards={rewards} />

      <SegmentedTabs<PeriodKind>
        label="Period"
        value={kind}
        onChange={setKind}
        options={[
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
      />
      <div className="flex items-center justify-between">
        <button type="button" aria-label={`Previous ${kind}`} onClick={() => step(-1)} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-track">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <span className="text-[15px] font-semibold text-ink" aria-live="polite">
          {label}
        </span>
        <button type="button" aria-label={`Next ${kind}`} disabled={isCurrent} onClick={() => step(1)} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-track disabled:opacity-30">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* Summary */}
      <section aria-label="Summary" className="card flex items-center gap-4 p-4">
        <Ring label={current.average === null ? "No finished days yet" : `${current.average}% average`} value={current.average ?? 0} size={96} stroke={9}>
          <span className="flex flex-col items-center leading-tight">
            <span className="text-[22px] font-semibold text-ink">{current.average === null ? "—" : `${current.average}%`}</span>
            <span className="text-[11px] text-ink-2">average</span>
          </span>
        </Ring>
        <div className="min-w-0 flex-1 space-y-1 text-[13px] text-ink">
          {trend !== null ? (
            <p className={`flex items-center gap-1 font-medium ${trend >= 0 ? "text-done" : "text-todo"}`}>
              {trend >= 0 ? <ArrowUpRight className="h-4 w-4" aria-hidden /> : <ArrowDownRight className="h-4 w-4" aria-hidden />}
              {trend === 0 ? "Same as" : `${Math.abs(trend)} pts ${trend > 0 ? "up on" : "down on"}`} last {kind}
            </p>
          ) : null}
          <p>
            <b>{current.perfectDays}</b> perfect day{current.perfectDays === 1 ? "" : "s"} of {current.countedDays}
          </p>
          {current.todaySoFar !== null ? <p className="text-ink-2">Today so far: {current.todaySoFar}%</p> : null}
          {/* One streak on screen: once rewards arrive, theirs (with freezes) is the streak. */}
          {rewards ? null : (
            <p className="flex items-center gap-3 text-[12px] text-ink-2">
              <span className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-progress" aria-hidden /> {streak.current} in a row
              </span>
              <span className="flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5" aria-hidden /> best {streak.best}
              </span>
            </p>
          )}
        </div>
      </section>

      {/* Days */}
      <section aria-label="Days" className="card p-4">
        {kind === "week" ? (
          <ul className="flex items-end justify-between gap-1">
            {current.days.map((d) => {
              const r = dayRings.get(d.date);
              return (
                <li key={d.date} className="flex-1">
                  <Link
                    href={d.kind === "future" ? "#" : `/?date=${d.date}`}
                    aria-label={`${DAY.format(utc(d.date))}: ${d.kind === "future" ? "to come" : r ? `${d.pct === null ? "free day" : `${d.pct}%`} · ${ringsLabel(r)}` : "free day"}`}
                    aria-disabled={d.kind === "future" || undefined}
                    className={`flex flex-col items-center gap-1 rounded-xl py-1.5 ${d.kind === "future" ? "pointer-events-none opacity-50" : "hover:bg-track"}`}
                  >
                    <RingStack
                      label=""
                      rings={r ? stackFromRings(r) : stackFromRings({ prayer: null, commit: null, balance: null })}
                      size={38}
                      stroke={4}
                      gap={1.5}
                    >
                      {r?.complete ? <span className="h-1.5 w-1.5 rounded-full bg-done" /> : null}
                    </RingStack>
                    <span className={`text-[12px] ${d.kind === "today" ? "font-semibold text-ink" : "text-ink-2"}`}>{WEEKDAY.format(utc(d.date))}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <Heatmap
            month={current.from.slice(0, 7)}
            marks={new Map(current.days.map((d) => [d.date, heatMark(d)]))}
            onMonth={(m) => setAnchor(`${m}-01`)}
            maxMonth={today.slice(0, 7)}
            weekStart={weekStart}
          />
        )}
        <p className="mt-2 text-[11.5px] text-ink-2">{kind === "week" ? "Tap a day to open it. " : ""}Days with nothing due are free days and don&apos;t count.</p>
      </section>

      {/* Insights */}
      {current.doingWell.length || current.needsAttention.length ? (
        <section aria-label="Insights" className="card space-y-2 p-4">
          {current.doingWell.map((c) => (
            <p key={`w-${c.category?.id ?? "none"}`} className="flex items-start gap-2 text-[13px] text-ink">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-done" aria-hidden />
              <span>
                Doing well: <b>{c.category?.name ?? "Other"}</b> {c.rate}%{c.best ? ` — ${c.best.item.title} leads` : ""}.
              </span>
            </p>
          ))}
          {current.needsAttention.map((c) => (
            <p key={`n-${c.category?.id ?? "none"}`} className="flex items-start gap-2 text-[13px] text-ink">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-progress" aria-hidden />
              <span>
                Needs attention: <b>{c.category?.name ?? "Other"}</b> {c.rate}%{c.mostMissed ? ` — most missed: ${c.mostMissed.item.title}` : ""}.
              </span>
            </p>
          ))}
        </section>
      ) : null}

      {/* By category */}
      {current.byCategory.length ? (
        <section aria-label="By category">
          <h2 className="mb-1.5 px-1 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">By category</h2>
          <ul className="card divide-y divide-border overflow-hidden">
            {current.byCategory.map((c) => (
              <CategoryRow key={c.category?.id ?? "none"} c={c} />
            ))}
          </ul>
        </section>
      ) : null}

      {group && prayerStats && prayerStats.totals.due ? (
        <Link href={`/items/view?id=${group.id}`} aria-label={`Prayers, ${label.toLowerCase()}`} className="card flex items-center gap-4 p-4">
          <Ring
            label={`${prayerStats.totals.prayed + prayerStats.totals.qada} of ${prayerStats.totals.due} prayers`}
            value={((prayerStats.totals.prayed + prayerStats.totals.qada) / prayerStats.totals.due) * 100}
            size={52}
            stroke={6}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-ink">Prayers</span>
            <span className="block text-[12.5px] text-ink-2">
              {prayerStats.totals.prayed} on time · {prayerStats.totals.qada} qada · {prayerStats.totals.missed} missed
              {prayerStats.mostMissed ? ` · most missed: ${prayerStats.mostMissed.title}` : ""}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-ink-2" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

function CategoryRow({ c }: { c: CategoryTally }) {
  const counts = [`${c.done} done`, `${c.missed} missed`, c.skipped ? `${c.skipped} skipped` : null, c.moved ? `${c.moved} moved` : null, c.late ? `${c.late} late` : null]
    .filter(Boolean)
    .join(" · ");
  const body = (
    <>
      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: c.category ? `var(--cat-${categoryTone(c.category)})` : "var(--track)" }}>
        {createElement(categoryIcon(c.category ?? undefined), { className: "h-4 w-4 text-ink" })}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[14px] font-medium text-ink">{c.category?.name ?? "Other"}</span>
          <span className="text-[13px] font-semibold text-ink tabular-nums">{c.rate === null ? "—" : `${c.rate}%`}</span>
        </span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-track">
          <span className={`block h-full rounded-full ${(c.rate ?? 0) >= 80 ? "bg-done" : (c.rate ?? 0) <= 50 ? "bg-progress" : "bg-primary"}`} style={{ width: `${c.rate ?? 0}%` }} />
        </span>
        <span className="mt-1 block text-[12px] text-ink-2">{counts}</span>
      </span>
    </>
  );
  return (
    <li>
      {c.category ? (
        <Link href={`/categories/view?id=${c.category.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-track/50">
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-3 py-2.5">{body}</div>
      )}
    </li>
  );
}
