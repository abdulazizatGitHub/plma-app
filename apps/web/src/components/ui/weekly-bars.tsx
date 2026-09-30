type WeeklyBarsProps = {
  /** Oldest first; the last entry is treated as today. */
  days: { date: string; value: number }[];
  max: number;
  formatValue?: (value: number) => string;
  className?: string;
};

function weekdayLetter(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(new Date(y, m - 1, d));
}

function weekdayShort(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(y, m - 1, d));
}

/** A 7-day bar chart — today in accent, earlier days in muted ink. */
export function WeeklyBars({
  days,
  max,
  formatValue = (v) => String(v),
  className = "",
}: WeeklyBarsProps) {
  const summary = days.map((d) => `${weekdayShort(d.date)} ${formatValue(d.value)}`).join(", ");

  return (
    <div className={`flex gap-2 ${className}`} role="img" aria-label={summary}>
      {days.map((day, i) => {
        const today = i === days.length - 1;
        const pct = max > 0 ? Math.min(100, (day.value / max) * 100) : 0;
        return (
          <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex h-20 w-full items-end overflow-hidden rounded-(--radius-chip) bg-ink/5">
              <div
                data-bar
                data-today={today ? "true" : undefined}
                className={`w-full rounded-(--radius-chip) transition-[height] duration-(--duration-slow) ease-(--ease-snap) ${
                  today ? "bg-accent" : "bg-ink/25"
                }`}
                style={{ height: `${Math.max(pct, 6)}%` }}
              />
            </div>
            <span className={`label-mono ${today ? "text-ink" : "text-ink-muted"}`}>
              {weekdayLetter(day.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
