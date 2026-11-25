"use client";

import { prayerInsights, type CategoryTally, type SummaryDay } from "@life/shared";
import { ArrowRight, CalendarDays, Check, ChevronRight, Circle, Target } from "lucide-react";
import Link from "next/link";
import { createElement, useMemo, useState } from "react";
import { Heatmap, type HeatMark } from "@/components/kit";
import { categoryIcon, categoryTone } from "@/lib/v2/category-style";
import { SyncingNote } from "@/components/history/syncing-note";
import {
  MONTH_SHORT,
  PeriodCard,
  PeriodTabs,
  STAT_TONE,
  Stat,
  SummaryCard,
  WEEKDAY_SHORT,
  WeekDots,
  YearMonths,
  periodRange,
  periodTitle,
  rangeLabel,
  stepPeriod,
  utc,
  type DayDot,
  type MonthDot,
  type Period,
} from "@/components/history/period-ui";
import { MosqueIcon } from "@/components/today/mosque-icon";
import { RewardsPanel } from "@/components/rewards/rewards-panel";
import { Leaderboard } from "@/components/social/leaderboard";
import { ShareSheet, type ShareWhat } from "@/components/social/share-sheet";
import { useRewards } from "@/lib/v2/use-rewards";
import { useHasSynced, useItemOccurrences, usePrayerSet, useUserSettings } from "@/lib/v2/use-day";
import { useRangeSummary } from "@/lib/v2/use-history";
import { useToday } from "@/lib/v2/use-today";

const KEY = "life_progress_period";
const LONG_DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
const LONG_MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });

function heatMark(d: SummaryDay): HeatMark {
  if (d.kind === "future") return "future";
  if (d.kind === "today") return "today";
  if (d.pct === null) return "not_due";
  return d.pct === 100 ? "done" : d.pct > 0 ? "partial" : "missed";
}

/** A day of the period as a circle: ticked when complete, a ring when part-done, red outline when missed. */
function dayDot(d: SummaryDay, todaySoFar: number | null): DayDot {
  const label = WEEKDAY_SHORT.format(utc(d.date));
  const when = LONG_DAY.format(utc(d.date));
  if (d.kind === "future") return { date: d.date, label, state: "future", aria: `${when}: to come` };
  if (d.kind === "today") {
    const pct = todaySoFar ?? d.pct ?? 0;
    return { date: d.date, label, state: pct === 100 ? "done" : "today", pct, href: `/?date=${d.date}`, aria: `${when}, today: ${pct}% so far` };
  }
  if (d.pct === null) return { date: d.date, label, state: "free", href: `/?date=${d.date}`, aria: `${when}: free day` };
  const state = d.pct === 100 ? "done" : d.pct > 0 ? "partial" : "missed";
  return { date: d.date, label, state, pct: d.pct, href: `/?date=${d.date}`, aria: `${when}: ${d.pct}%` };
}

/** Each month's average of finished days (Year view). */
function monthDots(days: SummaryDay[], today: string): MonthDot[] {
  const year = days[0]?.date.slice(0, 4) ?? today.slice(0, 4);
  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    const counted = days.filter((d) => d.date.startsWith(month) && d.kind === "past" && d.pct !== null);
    const pct = counted.length ? Math.round(counted.reduce((n, d) => n + (d.pct ?? 0), 0) / counted.length) : null;
    const future = `${month}-01` > today;
    const name = LONG_MONTH.format(utc(`${month}-15`));
    return { month, label: MONTH_SHORT.format(utc(`${month}-15`)).slice(0, 1), pct, future, aria: future ? `${name}: to come` : pct === null ? `${name}: no finished days` : `${name}: ${pct}% average` };
  });
}

/** Week / month / year history (HIS-02/03), laid out from the owner's mockup (2026-11-26). */
export default function ProgressPage() {
  const today = useToday();
  if (!today) return <div className="skeleton h-40" aria-busy="true" aria-label="Loading progress" />;
  return <Progress today={today} />;
}

function Progress({ today }: { today: string }) {
  const [kind, setKindState] = useState<Period>(() => {
    try {
      const saved = localStorage.getItem(KEY);
      return saved === "month" || saved === "year" ? saved : "week";
    } catch {
      return "week";
    }
  });
  const [anchor, setAnchor] = useState(today);
  const setKind = (k: Period) => {
    setKindState(k);
    setAnchor(today);
    try {
      localStorage.setItem(KEY, k);
    } catch {
      /* fine */
    }
  };
  const { weekStart } = useUserSettings();
  const range = periodRange(kind, anchor, weekStart);
  const summary = useRangeSummary(range.from, range.to, today);
  const synced = useHasSynced();
  const { rewards } = useRewards();
  const [share, setShare] = useState<ShareWhat | null>(null);
  const isCurrent = range.from <= today && today <= range.to;
  const next = kind === "week" ? "next week" : kind === "month" ? "next month" : "next year";

  // Prayers in the same period.
  const { group, prayers } = usePrayerSet();
  const prayerIds = useMemo(() => prayers.map((p) => p.id), [prayers]);
  const pTo = range.to < today ? range.to : today;
  const prayerOccs = useItemOccurrences(prayerIds, range.from, pTo);
  const prayerStats = useMemo(() => (group && range.from <= today ? prayerInsights(group, prayers, prayerOccs, range.from, pTo, today) : null), [group, prayers, prayerOccs, range.from, pTo, today]);

  // What to work on: the areas that need attention, else the lowest under 80%.
  const focus = (summary.needsAttention.length ? summary.needsAttention : summary.byCategory.filter((c) => c.rate !== null && c.rate < 80).sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0))).slice(0, 2);

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-semibold text-ink">Progress</h1>
          <p className="text-[13.5px] text-ink-2">Track your habits and growth</p>
        </div>
        <PeriodTabs value={kind} onChange={setKind} />
      </header>
      {synced === false ? <SyncingNote /> : null}

      <SummaryCard pct={summary.average} label={summary.average === null ? "No finished days yet" : `${summary.average}% overall`}>
        <Stat icon={<Check strokeWidth={2.5} />} tone={STAT_TONE.done} value={summary.totals.done} label="Habits done" />
        <Stat icon={<Circle />} tone={STAT_TONE.missed} value={summary.totals.missed} label="Missed" />
        <Stat icon={<CalendarDays />} tone={STAT_TONE.lilac} value={summary.perfectDays} label="Perfect days" />
      </SummaryCard>

      <PeriodCard label="Days" title={periodTitle(kind, isCurrent)} range={rangeLabel(kind, range)} onStep={(dir) => setAnchor(stepPeriod(kind, range, dir))} canNext={!isCurrent && range.to < today}
        unit={kind}>
        {kind === "week" ? (
          <WeekDots days={summary.days.map((d) => dayDot(d, summary.todaySoFar))} />
        ) : kind === "month" ? (
          <Heatmap month={range.from.slice(0, 7)} marks={new Map(summary.days.map((d) => [d.date, heatMark(d)]))} onMonth={(m) => setAnchor(`${m}-01`)} maxMonth={today.slice(0, 7)} weekStart={weekStart} />
        ) : (
          <YearMonths months={monthDots(summary.days, today)} />
        )}
      </PeriodCard>

      {summary.byCategory.length ? (
        <section aria-label="By category" className="card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-[17px] font-semibold text-ink">By category</h2>
            <Link href="/categories" className="inline-flex min-h-8 items-center gap-1 text-[13.5px] font-medium text-link">
              View details <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <ul>
            {summary.byCategory.map((c) => (
              <CategoryRow key={c.category?.id ?? "none"} c={c} />
            ))}
          </ul>
        </section>
      ) : null}

      {focus.length ? (
        <Link
          href={focus[0].category ? `/categories/view?id=${focus[0].category.id}` : "/categories"}
          className="flex items-center gap-3.5 rounded-(--radius-card) p-4 shadow-(--shadow-card) in-data-[mode=dark]:border in-data-[mode=dark]:border-border"
          style={{ background: "color-mix(in srgb, var(--primary) 12%, var(--surface))" }}
        >
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary-strong">
            <Target className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold text-ink">Focus for {next}</span>
            <span className="block text-[13.5px] text-ink-2">Improve {focus.map((c) => c.category?.name ?? "Other").join(" and ")} habits.</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink-2" aria-hidden />
        </Link>
      ) : null}

      {group && prayerStats && prayerStats.totals.due ? (
        <Link href={`/items/view?id=${group.id}`} aria-label={`Prayers, ${periodTitle(kind, isCurrent).toLowerCase()}`} className="card flex items-center gap-3.5 p-4">
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary-strong">
            <MosqueIcon className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-[16px] font-semibold text-ink">Prayers</span>
              <span className="text-[14px] font-semibold text-ink tabular-nums">{Math.round(((prayerStats.totals.prayed + prayerStats.totals.qada) / prayerStats.totals.due) * 100)}%</span>
            </span>
            <span className="block text-[12.5px] text-ink-2">
              {prayerStats.totals.prayed} on time · {prayerStats.totals.qada} qada · {prayerStats.totals.missed} missed
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink-2" aria-hidden />
        </Link>
      ) : null}

      <RewardsPanel rewards={rewards} onShareStreak={() => setShare({ kind: "streak", label: "your streak" })} />
      {/* Leaderboards are kept by week and month on the server. */}
      {kind !== "year" ? <Leaderboard period={kind} /> : null}
      <ShareSheet what={share} onClose={() => setShare(null)} />
    </div>
  );
}

/** Pastel tile, name, a bar and the % (mockup). Tapping opens the category. */
function CategoryRow({ c }: { c: CategoryTally }) {
  const body = (
    <>
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: c.category ? `var(--cat-${categoryTone(c.category)})` : "var(--track)" }}>
        {createElement(categoryIcon(c.category ?? undefined), { className: "h-5 w-5 text-ink", strokeWidth: 1.75 })}
      </span>
      <span className="w-24 shrink-0 truncate text-[15px] font-medium text-ink">{c.category?.name ?? "Other"}</span>
      <span aria-hidden className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-track">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${c.rate ?? 0}%` }} />
      </span>
      <span className="w-11 shrink-0 text-right text-[14.5px] font-semibold text-ink tabular-nums">{c.rate === null ? "—" : `${c.rate}%`}</span>
    </>
  );
  const row = "relative flex items-center gap-3 py-2.5 after:absolute after:right-0 after:bottom-0 after:left-13 after:h-px after:bg-border";
  const aria = `${c.category?.name ?? "Other"}: ${c.rate === null ? "nothing due" : `${c.rate}%`} · ${c.done} done, ${c.missed} missed`;
  return (
    <li className="last:[&>*]:after:hidden">
      {c.category ? (
        <Link href={`/categories/view?id=${c.category.id}`} aria-label={aria} className={row}>
          {body}
        </Link>
      ) : (
        <div role="img" aria-label={aria} className={row}>
          {body}
        </div>
      )}
    </li>
  );
}
