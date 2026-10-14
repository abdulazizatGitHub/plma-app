"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export type HeatMark = "done" | "partial" | "missed" | "skipped" | "today" | "not_due" | "future";

const FILL: Record<HeatMark, string> = {
  done: "bg-done text-on-fill font-semibold",
  partial: "bg-progress text-on-fill",
  missed: "bg-todo/25 text-ink",
  skipped: "border border-dashed border-border text-ink-2",
  today: "ring-2 ring-primary-strong text-ink font-semibold",
  not_due: "text-ink-2/60",
  future: "text-ink-2/40",
};

const WORD: Record<HeatMark, string> = {
  done: "done",
  partial: "started, not finished",
  missed: "missed",
  skipped: "skipped",
  today: "today, not done yet",
  not_due: "not scheduled",
  future: "upcoming",
};

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const utc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** "2026-10" → every date of that month, YYYY-MM-DD. */
export function monthDates(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

type HeatmapProps = {
  /** "YYYY-MM" */
  month: string;
  marks: Map<string, HeatMark>;
  onMonth: (month: string) => void;
  /** Latest month that can be shown (usually this month). */
  maxMonth: string;
  minMonth?: string;
  /** First day of the week, 0 = Sunday … 6 (the user's setting). Default Monday. */
  weekStart?: number;
};

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** Month calendar of an item's days (HIS-01): done / started / missed / skipped. */
export function Heatmap({ month, marks, onMonth, maxMonth, minMonth, weekStart = 1 }: HeatmapProps) {
  const dates = monthDates(month);
  const lead = (utc(dates[0]).getUTCDay() - weekStart + 7) % 7;
  return (
    <figure aria-label={`${MONTH.format(utc(dates[0]))} history`}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={minMonth !== undefined && month <= minMonth}
          onClick={() => onMonth(shiftMonth(month, -1))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-track disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <span className="text-[13px] font-medium text-ink">{MONTH.format(utc(dates[0]))}</span>
        <button
          type="button"
          aria-label="Next month"
          disabled={month >= maxMonth}
          onClick={() => onMonth(shiftMonth(month, 1))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-track disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-ink-2" aria-hidden>
        {Array.from({ length: 7 }, (_, i) => LETTERS[(weekStart + i) % 7]).map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <ol className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <li key={`lead-${i}`} aria-hidden />
        ))}
        {dates.map((date) => {
          const mark = marks.get(date) ?? "not_due";
          return (
            <li
              key={date}
              data-mark={mark}
              aria-label={`${LONG.format(utc(date))}: ${WORD[mark]}`}
              className={`flex aspect-square items-center justify-center rounded-lg text-[12px] ${FILL[mark]}`}
            >
              {Number(date.slice(8))}
            </li>
          );
        })}
      </ol>
      <figcaption className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-2">
        {(["done", "partial", "missed", "skipped"] as const).map((m) => (
          <span key={m} className="flex items-center gap-1">
            <span aria-hidden className={`h-2.5 w-2.5 rounded-[3px] ${FILL[m].split(" ")[0]} ${m === "skipped" ? "border border-dashed border-border" : ""}`} />
            {WORD[m]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
