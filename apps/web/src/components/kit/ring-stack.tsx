import type { ReactNode } from "react";

export type StackRing = {
  key: string;
  /** 0–100; null = nothing due (a free ring, drawn as a faint dotted track). */
  pct: number | null;
  /** CSS colour, e.g. "var(--done)". */
  color: string;
  closed?: boolean;
};

type RingStackProps = {
  label: string;
  /** Outermost first. */
  rings: StackRing[];
  size?: number;
  stroke?: number;
  /** Space between rings. */
  gap?: number;
  /** A ring that just closed: a soft pulse. */
  pulse?: string | null;
  children?: ReactNode;
  className?: string;
  /** An overall 0–100 for tests and tooling (`data-value`). */
  value?: number;
};

/**
 * Concentric rings, like the Health app's: each fills toward its goal on a
 * faint track of its own colour. Phase 8.1 (owner, 2026-10-15).
 */
export function RingStack({ label, rings, size = 112, stroke = 10, gap = 3, pulse, children, className = "", value }: RingStackProps) {
  const center = size / 2;
  return (
    <div role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} data-value={value} className={`relative inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        {rings.map((r, i) => {
          const radius = center - stroke / 2 - i * (stroke + gap);
          if (radius <= stroke / 2) return null;
          const c = 2 * Math.PI * radius;
          const pct = r.pct === null ? 0 : Math.min(100, Math.max(0, r.pct));
          return (
            <g key={r.key} data-ring={r.key} data-pct={r.pct ?? "free"} className={pulse === r.key ? "ring-pulse" : undefined} style={{ transformOrigin: "center" }}>
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                strokeWidth={stroke}
                style={{ stroke: r.color, opacity: r.pct === null ? 0.12 : 0.2 }}
                strokeDasharray={r.pct === null ? `${stroke * 0.2} ${stroke * 0.9}` : undefined}
                strokeLinecap={r.pct === null ? "round" : undefined}
              />
              {pct > 0 ? (
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={c - (pct / 100) * c}
                  className="transition-[stroke-dashoffset] duration-(--duration-slow) ease-(--ease-standard)"
                  style={{ stroke: r.color }}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      {children ? <div className="absolute inset-0 flex items-center justify-center text-center">{children}</div> : null}
    </div>
  );
}
