"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Ring } from "@/components/kit";

/*
 * Building blocks of the Progress look (owner mockup, 2026-11-26), shared by
 * Progress and an item's page: Week / Month / Year pills, the big ring with
 * three stats, the row of day circles, and the twelve month rings.
 */

export type Period = "week" | "month" | "year";

const PERIODS: [Period, string][] = [
  ["week", "Week"],
  ["month", "Month"],
  ["year", "Year"],
];

/** White pill with the chosen period filled (not `.card`: its radius can't be overridden). */
export function PeriodTabs({ value, onChange, label = "Period" }: { value: Period; onChange: (p: Period) => void; label?: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex shrink-0 rounded-full bg-surface p-1 shadow-(--shadow-card) in-data-[mode=dark]:border in-data-[mode=dark]:border-border">
      {PERIODS.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={`transition-token min-h-9 rounded-full px-3.5 text-[13.5px] font-medium ${value === v ? "bg-primary-strong text-on-primary-strong" : "text-ink-2 hover:text-ink"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** Stat tile backgrounds, mixed from the status and category tokens. */
export const STAT_TONE = {
  done: "color-mix(in srgb, var(--done) 30%, var(--surface))",
  missed: "color-mix(in srgb, var(--todo) 18%, var(--surface))",
  lilac: "var(--cat-lilac)",
  peach: "var(--cat-peach)",
} as const;

/** One stat: a tinted icon tile, the number, and what it counts. */
export function Stat({ icon, tone, value, label }: { icon: ReactNode; tone: string; value: string | number; label: string }) {
  return (
    <li className="flex items-center gap-3">
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink [&>svg]:h-5 [&>svg]:w-5" style={{ background: tone }}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[18px] leading-tight font-semibold text-ink tabular-nums">{value}</span>
        <span className="block truncate text-[13px] text-ink-2">{label}</span>
      </span>
    </li>
  );
}

/** The big ring ("62% Overall") beside a column of stats. */
export function SummaryCard({ pct, label, caption = "Overall", children }: { pct: number | null; label: string; caption?: string; children: ReactNode }) {
  return (
    <section aria-label="Summary" className="card flex items-center gap-4 p-4">
      <Ring label={label} value={pct ?? 0} size={112} stroke={12}>
        <span className="flex flex-col items-center leading-tight">
          <span className="text-[26px] font-semibold text-ink tabular-nums">{pct === null ? "—" : `${pct}%`}</span>
          <span className="text-[12.5px] text-ink-2">{caption}</span>
        </span>
      </Ring>
      <span aria-hidden className="w-px self-stretch bg-border" />
      <ul className="min-w-0 flex-1 space-y-3">{children}</ul>
    </section>
  );
}

/** A card with a title and, on the right, the period's dates with ‹ › to step through. */
export function PeriodCard({
  title,
  range,
  onStep,
  canNext,
  unit = "period",
  children,
  label,
}: {
  title: string;
  range: string;
  onStep?: (dir: -1 | 1) => void;
  canNext?: boolean;
  /** "week", "month" or "year": names the ‹ › buttons. */
  unit?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-ink">{title}</h2>
        {onStep ? (
          <button type="button" aria-label={`Previous ${unit}`} onClick={() => onStep(-1)} className="-my-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-track">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        <span className="text-[13.5px] whitespace-nowrap text-ink-2" aria-live="polite">
          {range}
        </span>
        {onStep ? (
          <button type="button" aria-label={`Next ${unit}`} disabled={!canNext} onClick={() => onStep(1)} className="-my-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-track disabled:opacity-30">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export type DayDot = {
  date: string;
  /** "Mon" */
  label: string;
  /** done = green tick; partial / today = a ring at `pct`; missed = red outline; free = dashed; future = empty. */
  state: "done" | "partial" | "missed" | "free" | "future" | "today";
  pct?: number;
  /** Where tapping goes (a day on Today). */
  href?: string;
  aria: string;
};

function DotShape({ d }: { d: DayDot }) {
  if (d.state === "done") {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-xl text-ink" style={{ background: STAT_TONE.done }}>
        <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
      </span>
    );
  }
  if (d.state === "partial" || d.state === "today") return <Ring label="" value={d.pct ?? 0} size={40} stroke={4} />;
  const edge = d.state === "missed" ? "border-todo/70" : d.state === "free" ? "border-dashed border-border" : "border-track";
  return <span className={`h-10 w-10 rounded-full border-[2.5px] ${edge}`} />;
}

/** Seven day circles with their weekday underneath. */
export function WeekDots({ days }: { days: DayDot[] }) {
  return (
    <ul className="flex justify-between gap-1">
      {days.map((d) => {
        const body = (
          <>
            <DotShape d={d} />
            <span className={`text-[13px] ${d.state === "today" ? "font-semibold text-ink" : "text-ink-2"}`}>{d.label}</span>
          </>
        );
        return (
          <li key={d.date} className="flex-1">
            {d.href ? (
              <Link href={d.href} aria-label={d.aria} className="flex flex-col items-center gap-1.5 rounded-xl py-1 hover:bg-track/60">
                {body}
              </Link>
            ) : (
              <span role="img" aria-label={d.aria} className="flex flex-col items-center gap-1.5 py-1">
                {body}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export type MonthDot = { month: string; label: string; pct: number | null; future: boolean; aria: string };

/** Twelve small rings, one per month (Year view). */
export function YearMonths({ months }: { months: MonthDot[] }) {
  return (
    <ul className="grid grid-cols-6 gap-y-3">
      {months.map((m) => (
        <li key={m.month} role="img" aria-label={m.aria} className="flex flex-col items-center gap-1.5">
          {m.future || m.pct === null ? <span className={`h-10 w-10 rounded-full border-[2.5px] ${m.future ? "border-track" : "border-dashed border-border"}`} /> : <Ring label="" value={m.pct} size={40} stroke={4} />}
          <span className="text-[12.5px] text-ink-2">{m.label}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---- dates ---- */

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const DAY_ONLY = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
export const WEEKDAY_SHORT = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
export const MONTH_SHORT = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
export const utc = (d: string) => new Date(`${d}T12:00:00Z`);

export function shiftDays(d: string, days: number): string {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + days)).toISOString().slice(0, 10);
}

/** The week (from the user's week start), month or calendar year holding `anchor`. */
export function periodRange(kind: Period, anchor: string, weekStart: number): { from: string; to: string } {
  const [y, m, d] = anchor.split("-").map(Number);
  if (kind === "year") return { from: `${y}-01-01`, to: `${y}-12-31` };
  if (kind === "month") {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${anchor.slice(0, 7)}-01`, to: `${anchor.slice(0, 7)}-${String(last).padStart(2, "0")}` };
  }
  const back = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() - weekStart + 7) % 7;
  const from = shiftDays(anchor, -back);
  return { from, to: shiftDays(from, 6) };
}

/** An anchor inside the period before (-1) or after (1). */
export function stepPeriod(kind: Period, range: { from: string; to: string }, dir: -1 | 1): string {
  if (kind === "week") return shiftDays(range.from, dir * 7);
  if (kind === "month") return dir < 0 ? shiftDays(range.from, -1) : shiftDays(range.to, 1);
  return `${Number(range.from.slice(0, 4)) + dir}-06-15`;
}

/** "18 – 24 Nov", "November 2026", "2026". */
export function rangeLabel(kind: Period, range: { from: string; to: string }): string {
  if (kind === "year") return range.from.slice(0, 4);
  if (kind === "month") return MONTH.format(utc(range.from));
  const sameMonth = range.from.slice(0, 7) === range.to.slice(0, 7);
  return `${sameMonth ? DAY_ONLY.format(utc(range.from)) : DAY.format(utc(range.from))} – ${DAY.format(utc(range.to))}`;
}

/** "This week" for the current period, else "Week" / "Month" / "Year". */
export function periodTitle(kind: Period, isCurrent: boolean): string {
  const word = kind === "week" ? "week" : kind === "month" ? "month" : "year";
  return isCurrent ? `This ${word}` : `${word[0].toUpperCase()}${word.slice(1)}`;
}
