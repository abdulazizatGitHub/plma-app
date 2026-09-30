import type { ReactNode } from "react";

type ListRowProps = {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  done?: boolean;
  className?: string;
};

export function ListRow({ icon, label, value, done, className = "" }: ListRowProps) {
  return (
    <div className={`flex items-center gap-3 py-3 ${className}`}>
      {icon ? (
        <span
          className={`transition-token flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            done ? "bg-success/15 text-success" : "bg-surface-sunken text-ink-muted"
          }`}
        >
          {icon}
        </span>
      ) : null}
      <span className="flex-1 text-sm font-medium text-ink">{label}</span>
      <span className={`transition-token-fast text-sm tabular-nums ${done ? "text-success" : "text-ink-muted"}`}>
        {value}
      </span>
    </div>
  );
}

export function ListDivider() {
  return <div role="separator" className="h-px bg-line" />;
}
