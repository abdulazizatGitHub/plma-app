import type { ReactNode } from "react";

const SIZES = {
  sm: { px: 56, stroke: 6, gap: 4 },
  lg: { px: 168, stroke: 14, gap: 6 },
  xl: { px: 200, stroke: 16, gap: 8 },
} as const;

/** Visible on every surface in both modes — `--surface-sunken` vanished on cards. */
const TRACK = "color-mix(in srgb, var(--ink) 12%, transparent)";

type ProgressRingProps = {
  /** Accessible description, e.g. "43% of today's habits done". */
  label: string;
  size?: keyof typeof SIZES;
  /** 0–100, for a single continuous accent arc. Ignored when `segments` is set. */
  value?: number;
  /** One arc per item with small gaps; `null` leaves that arc as bare track. */
  segments?: (string | null)[];
  className?: string;
  children?: ReactNode;
};

export function ProgressRing({
  label,
  size = "lg",
  value = 0,
  segments,
  className = "",
  children,
}: ProgressRingProps) {
  const { px, stroke, gap } = SIZES[size];
  const radius = (px - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = px / 2;
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: px, height: px }}
      role="img"
      aria-label={label}
      data-value={segments ? undefined : clamped}
    >
      <svg width={px} height={px} className="-rotate-90" aria-hidden>
        {segments ? (
          segments.map((color, i) => {
            const slot = circumference / segments.length;
            // Round caps overhang by stroke/2 at each end, so reserve that too.
            const dash = Math.max(0, slot - gap - stroke);
            return (
              <circle
                key={i}
                data-segment={color ? "filled" : "empty"}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-(i * slot + (gap + stroke) / 2)}
                className="transition-[stroke] duration-(--duration-base) ease-(--ease-standard)"
                style={{ stroke: color ?? TRACK }}
              />
            );
          })
        ) : (
          <>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              style={{ stroke: TRACK }}
            />
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
              className="transition-[stroke-dashoffset] duration-(--duration-slow) ease-(--ease-snap)"
              style={{ stroke: "var(--accent)" }}
            />
          </>
        )}
      </svg>
      {children ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}
