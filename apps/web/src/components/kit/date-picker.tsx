"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { addDays, weekStart } from "./date-strip";

/*
 * Calendar date picker in the app's own look (owner, 2026-10-13: the
 * browser's date box looked out of place). One tap on a day picks it; quick
 * chips cover the usual answers (Tomorrow, Next Monday…). Values are ISO
 * "YYYY-MM-DD" like everywhere else.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const FULL = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const SHORT = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** "Wed 14 Oct" (empty for no value). */
export function dateLabel(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? SHORT.format(parse(value)) : "";
}

export type DateChip = { label: string; value: string };

/** Tomorrow, the day after, next Monday and in a week, from `today`. */
export function quickDates(today: string): DateChip[] {
  const nextMonday = addDays(weekStart(today), 7);
  const chips = [
    { label: "Tomorrow", value: addDays(today, 1) },
    { label: "Day after", value: addDays(today, 2) },
    { label: "Next Monday", value: nextMonday },
    { label: "In a week", value: addDays(today, 7) },
  ];
  const seen = new Set<string>();
  return chips.filter((c) => (seen.has(c.value) ? false : (seen.add(c.value), true)));
}

type CalendarProps = {
  value: string;
  onChange: (iso: string) => void;
  today: string;
  /** Earliest pickable day (e.g. today when moving a task). */
  min?: string;
};

/** A month grid, Monday first. Today is outlined, the picked day filled. */
export function Calendar({ value, onChange, today, min }: CalendarProps) {
  const [month, setMonth] = useState(() => (value || today).slice(0, 7));
  const first = parse(`${month}-01`);
  const start = weekStart(`${month}-01`);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  // Drop a trailing week that's entirely next month.
  const shown = days.slice(0, days[35].slice(0, 7) === month ? 42 : 35);
  const shift = (n: number) => setMonth(iso(new Date(first.getFullYear(), first.getMonth() + n, 1)).slice(0, 7));
  return (
    <div className="select-none">
      <div className="mb-1.5 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-track">
          <ChevronLeft className="h-4.5 w-4.5" aria-hidden />
        </button>
        <span className="text-[14px] font-semibold text-ink" aria-live="polite">
          {MONTH.format(first)}
        </span>
        <button type="button" aria-label="Next month" onClick={() => shift(1)} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-track">
          <ChevronRight className="h-4.5 w-4.5" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center" role="grid" aria-label={MONTH.format(first)}>
        {WEEKDAYS.map((w) => (
          <span key={w} role="columnheader" className="pb-1 text-[11px] font-medium text-ink-2">
            {w}
          </span>
        ))}
        {shown.map((d) => {
          const out = d.slice(0, 7) !== month;
          const picked = d === value;
          const isToday = d === today;
          const disabled = !!min && d < min;
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              aria-label={`${FULL.format(parse(d))}${isToday ? ", today" : ""}`}
              aria-selected={picked}
              disabled={disabled}
              onClick={() => onChange(d)}
              className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-[13.5px] tabular-nums transition-token disabled:opacity-30 ${
                picked ? "bg-primary-strong font-semibold text-on-primary-strong" : isToday ? "font-semibold text-ink ring-2 ring-primary-strong ring-inset" : out ? "text-ink-2 opacity-60 hover:bg-track" : "text-ink hover:bg-track"
              }`}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  today: string;
  optional?: boolean;
  placeholder?: string;
  min?: string;
  error?: string | null;
  hideLabel?: boolean;
  /** Tomorrow / Next Monday… chips above the calendar. */
  quick?: boolean;
  size?: "md" | "sm";
  /** Open as a floating panel instead of pushing the layout down. */
  floating?: boolean;
};

/** A date button ("Wed 14 Oct") that opens the calendar; one tap on a day picks it. */
export function DateField({ label, value, onChange, today, optional, placeholder = "Pick a date", min, error, hideLabel, quick, size = "md", floating }: DateFieldProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const pick = (d: string) => {
    onChange(d);
    setOpen(false);
  };
  const shown = dateLabel(value);
  return (
    <div className={floating ? "relative" : undefined}>
      {hideLabel ? null : <span className="mb-1 block text-[12px] font-medium text-ink">{label}</span>}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-label={`${label}: ${shown || "not set"}`}
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 border bg-surface ${size === "sm" ? "h-8 min-w-28 rounded-[10px] px-2 text-[12.5px]" : "h-10 min-w-36 rounded-[12px] px-3 text-[14px]"} ${shown ? "text-ink" : "text-ink-2"} ${
          error ? "border-todo" : "border-border"
        } hover:border-primary-strong`}
      >
        <CalendarDays className="h-4 w-4 text-ink-2" aria-hidden />
        {shown || placeholder}
      </button>
      {error ? (
        <p role="alert" className="mt-1 text-[12px] text-todo">
          {error}
        </p>
      ) : null}
      {open ? (
        <div
          id={`${id}-panel`}
          className={`mt-2 space-y-2 rounded-2xl border border-border bg-surface p-2.5 ${floating ? "absolute left-0 z-30 w-[19rem] shadow-[0_12px_32px_rgb(27_26_34/18%)]" : ""}`}
        >
          {quick ? <DateChips today={today} min={min} value={value} onPick={pick} /> : null}
          <Calendar value={value} onChange={pick} today={today} min={min} />
          {optional && value ? (
            <div className="flex justify-end">
              <button type="button" onClick={() => pick("")} className="min-h-8 rounded-full px-3 text-[12px] font-medium text-ink hover:bg-track">
                Clear
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Tomorrow · Day after · Next Monday · In a week, as one-tap chips. */
export function DateChips({ today, value, onPick, min }: { today: string; value?: string; onPick: (iso: string) => void; min?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {quickDates(today)
        .filter((c) => !min || c.value >= min)
        .map((c) => (
          <button
            key={c.label}
            type="button"
            aria-pressed={c.value === value}
            onClick={() => onPick(c.value)}
            className={`flex min-h-8 flex-col items-start justify-center rounded-xl px-3 py-1 text-left ${c.value === value ? "bg-primary text-on-fill" : "bg-track text-ink hover:bg-border"}`}
          >
            <span className="text-[12.5px] font-medium">{c.label}</span>
            <span className="text-[11px] opacity-75">{dateLabel(c.value)}</span>
          </button>
        ))}
    </div>
  );
}
