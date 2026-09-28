const SIZES = {
  lg: "text-6xl",
  md: "text-4xl",
} as const;

type StatNumberProps = {
  value: string;
  label?: string;
  size?: keyof typeof SIZES;
  className?: string;
};

export function StatNumber({ value, label, size = "lg", className = "" }: StatNumberProps) {
  return (
    <div className={className}>
      <div className={`font-display ${SIZES[size]} leading-none font-medium tabular-nums text-ink`}>
        {value}
      </div>
      {label ? <p className="mt-1.5 text-sm text-ink-muted">{label}</p> : null}
    </div>
  );
}
