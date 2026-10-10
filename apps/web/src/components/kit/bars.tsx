type BarsProps = {
  /** Accessible summary, e.g. "Steps, last 7 days". */
  label: string;
  values: number[];
  /** Short labels under each bar (e.g. M T W…). */
  labels?: string[];
  /** Defaults to the largest value. */
  max?: number;
  /** Bar drawn in the strong color (usually today). */
  highlight?: number;
  height?: number;
};

/** Slim, fully rounded vertical bars on the track color (owner reference 1). */
export function Bars({ label, values, labels, max, highlight, height = 72 }: BarsProps) {
  const top = Math.max(max ?? Math.max(...values, 0), 1);
  return (
    <figure role="img" aria-label={label} className="flex items-end justify-between gap-2">
      {values.map((v, i) => {
        const pct = Math.min(100, Math.max(0, (v / top) * 100));
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="relative w-1.5 overflow-hidden rounded-full bg-track" style={{ height }}>
              <div
                data-bar={i}
                className={`absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-(--duration-slow) ${
                  i === highlight ? "bg-primary-strong" : "bg-primary"
                }`}
                style={{ height: `${pct}%` }}
              />
            </div>
            {labels?.[i] ? <span className="text-[11px] text-ink-2">{labels[i]}</span> : null}
          </div>
        );
      })}
    </figure>
  );
}
