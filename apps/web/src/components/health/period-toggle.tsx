import type { HealthPeriod } from "@life/shared";

const OPTIONS: { value: HealthPeriod; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

type PeriodToggleProps = {
  value: HealthPeriod;
  onChange: (value: HealthPeriod) => void;
};

/** Segmented control choosing which period the stat rows summarise. */
export function PeriodToggle({ value, onChange }: PeriodToggleProps) {
  return (
    <div
      role="group"
      aria-label="Stats period"
      className="flex gap-1.5 rounded-(--radius-control) bg-surface-sunken p-1"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`press-pop transition-token min-h-10 flex-1 rounded-(--radius-chip) text-sm font-semibold ${
            value === option.value ? "bg-surface text-ink shadow-sm" : "text-ink-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
