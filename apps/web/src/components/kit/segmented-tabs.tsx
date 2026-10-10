type SegmentedTabsProps<T extends string> = {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** Pill segmented control on the track color; selected = white pill (ref 2). */
export function SegmentedTabs<T extends string>({ label, options, value, onChange }: SegmentedTabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-full bg-track p-0.5">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(o.value)}
            className={`transition-token min-h-8 flex-1 rounded-full px-2.5 text-[12px] font-medium ${
              selected ? "bg-surface text-ink shadow-(--shadow-card)" : "text-ink-2 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
