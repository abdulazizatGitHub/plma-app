"use client";

import { Pill } from "./pickers";

/**
 * One choice from a few chips — numbers like "10 min" or "3 times" without
 * typing (owner, 2026-10-13). `legend` names the group for screen readers.
 */
export function ChipChoice<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  hideLegend,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  hideLegend?: boolean;
}) {
  return (
    <fieldset>
      <legend className={hideLegend ? "sr-only" : "mb-1 text-[12px] font-medium text-ink"}>{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Pill key={String(o.value)} selected={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </Pill>
        ))}
      </div>
    </fieldset>
  );
}
