"use client";

import { Check, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CATEGORY_TONES, toneInkClass, type CategoryTone } from "@/lib/theme/tokens";

/** Grid of icon buttons (category editor). One is always selected. */
export function IconPicker({
  label,
  options,
  value,
  onChange,
  tone,
}: {
  label: string;
  options: { key: string; Icon: LucideIcon }[];
  value: string;
  onChange: (key: string) => void;
  /** Fill for the selected icon, so it previews the category. */
  tone: CategoryTone;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-8 gap-1.5">
      {options.map(({ key, Icon }) => {
        const selected = key === value;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={key}
            onClick={() => onChange(key)}
            className={`flex aspect-square items-center justify-center rounded-[10px] transition-token ${
              selected ? `${toneInkClass(tone)} ring-2 ring-ink ring-offset-1 ring-offset-surface` : "bg-track text-ink-2 hover:text-ink"
            }`}
            style={selected ? { background: `var(--cat-${tone})` } : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

/** The category pastels as round swatches. */
export function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (tone: CategoryTone) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {CATEGORY_TONES.map((tone) => {
        const selected = tone === value;
        return (
          <button
            key={tone}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={tone}
            onClick={() => onChange(tone)}
            className={`flex h-8 w-8 items-center justify-center rounded-full border border-border ${toneInkClass(tone)} ${
              selected ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
            }`}
            style={{ background: `var(--cat-${tone})` }}
          >
            {selected ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Compact single-choice pills (When, Category, Kind…). */
export function Pill({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`transition-token flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium ${
        selected ? "bg-primary text-on-fill" : "bg-track text-ink hover:bg-border"
      }`}
    >
      {children}
    </button>
  );
}

export function PillGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-[12px] font-medium text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Pill key={o.value} selected={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </Pill>
        ))}
      </div>
    </fieldset>
  );
}
