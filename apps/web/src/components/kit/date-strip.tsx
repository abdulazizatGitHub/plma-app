"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/** Adds days to a local YYYY-MM-DD date (noon anchor avoids DST edge cases). */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Monday of the week containing `iso`. */
export function weekStart(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(y, m - 1, d, 12).getDay(); // 0 = Sun
  return addDays(iso, -((dow + 6) % 7));
}

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const LONG = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });

function toDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

type DateStripProps = {
  selected: string;
  today: string;
  onSelect: (iso: string) => void;
  /** Days that have items (shown with a dot). */
  marked?: ReadonlySet<string>;
};

/** One week (Mon–Sun) of day pills with prev/next week; past and future are both selectable. */
export function DateStrip({ selected, today, onSelect, marked }: DateStripProps) {
  const start = weekStart(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous week"
        onClick={() => onSelect(addDays(selected, -7))}
        className="inline-flex h-10 w-7 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-track"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <ol className="flex flex-1 justify-between gap-1">
        {days.map((iso) => {
          const date = toDate(iso);
          const isSelected = iso === selected;
          const isToday = iso === today;
          return (
            <li key={iso} className="flex-1">
              <button
                type="button"
                aria-label={`${LONG.format(date)}${isToday ? ", today" : ""}`}
                aria-current={isSelected ? "date" : undefined}
                onClick={() => onSelect(iso)}
                className={`transition-token flex min-h-[52px] w-full flex-col items-center justify-center gap-0 rounded-full text-ink ${
                  isSelected ? "bg-primary text-on-fill" : isToday ? "ring-1 ring-primary-strong" : "hover:bg-track"
                }`}
              >
                <span className={`text-[11px] ${isSelected ? "" : "text-ink-2"}`}>{WEEKDAY.format(date).slice(0, 2)}</span>
                <span className="text-[14px] font-semibold">{date.getDate()}</span>
                <span
                  aria-hidden
                  className={`h-1 w-1 rounded-full ${marked?.has(iso) ? (isSelected ? "bg-on-fill" : "bg-primary-strong") : "bg-transparent"}`}
                />
              </button>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        aria-label="Next week"
        onClick={() => onSelect(addDays(selected, 7))}
        className="inline-flex h-10 w-7 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-track"
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
