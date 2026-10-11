import type { ReactNode } from "react";

export type RingSegment = "done" | "qada" | "missed" | "open";

const SEGMENT_COLOR: Record<RingSegment, string> = {
  done: "var(--done)",
  qada: "var(--progress)",
  missed: "var(--todo)",
  open: "var(--track)",
};

type RingProps = {
  /** Accessible description, e.g. "60% of today done". */
  label: string;
  /** 0–100 for a single arc. Ignored when `segments` is set. */
  value?: number;
  /** One arc per item (e.g. each prayer), with small gaps. */
  segments?: RingSegment[];
  size?: number;
  stroke?: number;
  className?: string;
  children?: ReactNode;
};

/** Thin ring with round caps on the track color; content is centred inside. */
export function Ring({
  label,
  value = 0,
  segments,
  size = 48,
  stroke = 6,
  className = "",
  children,
}: RingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const clamped = Math.round(Math.min(100, Math.max(0, value)));

  return (
    <div
      role="img"
      aria-label={label}
      data-value={clamped}
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        {segments ? (
          segments.map((segment, i) => {
            const slot = circumference / segments.length;
            const gap = segments.length > 1 ? 4 : 0;
            const dash = Math.max(0, slot - gap - stroke);
            return (
              <circle
                key={i}
                data-segment={segment}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-(i * slot + (gap + stroke) / 2)}
                className="transition-[stroke] duration-(--duration-base)"
                style={{ stroke: SEGMENT_COLOR[segment] }}
              />
            );
          })
        ) : (
          <>
            <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={stroke} style={{ stroke: "var(--track)" }} />
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (clamped / 100) * circumference}
              opacity={clamped === 0 ? 0 : 1}
              className="transition-[stroke-dashoffset] duration-(--duration-slow) ease-(--ease-standard)"
              style={{ stroke: "var(--primary)" }}
            />
          </>
        )}
      </svg>
      {children ? (
        <div className="absolute inset-0 flex items-center justify-center text-center">{children}</div>
      ) : null}
    </div>
  );
}
