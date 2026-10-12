"use client";

import { Minus, Plus } from "lucide-react";
import { useId } from "react";

const digitsOnly = (raw: string, max: number) => raw.replace(/\D/g, "").slice(0, max);

/**
 * − value + for numbers (owner, 2026-10-13: tap, don't type). The value
 * stays typeable for big jumps (10,000 steps); the buttons step by `step`
 * and stay within min/max. Strings in, strings out, like the forms.
 */
export function NumberStepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9_999_999,
  unit,
  hint,
  error,
  required,
  hideLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  hideLabel?: boolean;
}) {
  const id = useId();
  const n = value === "" ? null : Number(value);
  const bump = (dir: 1 | -1) => {
    const base = n ?? (dir > 0 ? min - step : min + step);
    // Snap to the step grid, then move one step.
    const next = Math.min(max, Math.max(min, (dir > 0 ? Math.floor(base / step) + 1 : Math.ceil(base / step) - 1) * step));
    onChange(String(next));
  };
  const btn = "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-track text-ink hover:bg-border disabled:opacity-40";
  return (
    <div>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "mb-1 block text-[12px] font-medium text-ink"}>
        {label}
        {required && !hideLabel ? (
          <span className="ml-0.5 text-ink-2" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label={`${label} minus ${step}`} disabled={n !== null && n <= min} onClick={() => bump(-1)} className={btn}>
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(digitsOnly(e.target.value, String(max).length))}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className={`h-10 w-20 min-w-0 rounded-[12px] border bg-surface px-2 text-center text-[15px] font-semibold text-ink tabular-nums outline-none focus:border-primary-strong ${error ? "border-todo" : "border-border"}`}
        />
        <button type="button" aria-label={`${label} plus ${step}`} disabled={n !== null && n >= max} onClick={() => bump(1)} className={btn}>
          <Plus className="h-4 w-4" aria-hidden />
        </button>
        {unit ? <span className="ml-1 text-[13px] text-ink-2">{unit}</span> : null}
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1 text-[12px] text-todo">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-[12px] text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
