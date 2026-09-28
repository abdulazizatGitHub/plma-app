type HistoryStripProps = {
  days: boolean[];
  className?: string;
};

/** A compact bar per day (most recent last) — done days filled, others muted. */
export function HistoryStrip({ days, className = "" }: HistoryStripProps) {
  return (
    <div className={`flex gap-1 ${className}`} aria-hidden="true">
      {days.map((done, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full ${done ? "bg-success" : "bg-surface-sunken"}`}
        />
      ))}
    </div>
  );
}
