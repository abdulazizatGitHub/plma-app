type HistoryStripProps = {
  days: boolean[];
  className?: string;
};

/**
 * One small bar per day (most recent last). Uses `currentColor`, so a tile
 * recolors it just by setting its own text color.
 */
export function HistoryStrip({ days, className = "" }: HistoryStripProps) {
  return (
    <div className={`flex gap-1 ${className}`} aria-hidden="true">
      {days.map((done, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full bg-current ${done ? "opacity-80" : "opacity-15"}`}
        />
      ))}
    </div>
  );
}
