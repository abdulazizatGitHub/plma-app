type ProgressBarProps = {
  value: number;
  max?: number;
  label?: string;
  className?: string;
};

export function ProgressBar({
  value,
  max = 100,
  label,
  className = "",
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label ? (
        <div className="flex justify-between text-xs text-ink-muted">
          <span>{label}</span>
          <span>{pct}%</span>
        </div>
      ) : null}
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-sunken"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
