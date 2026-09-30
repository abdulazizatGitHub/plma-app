type StatProps = {
  value: string;
  label: string;
  className?: string;
};

/** A big tight numeral over a mono caption — used in stat rows on detail pages. */
export function Stat({ value, label, className = "" }: StatProps) {
  return (
    <div className={className}>
      <p className="font-display text-3xl leading-none font-semibold tracking-[-0.04em] tabular-nums text-ink">
        {value}
      </p>
      <p className="label-mono mt-1.5 text-ink-muted">{label}</p>
    </div>
  );
}
