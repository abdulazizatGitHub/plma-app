"use client";

import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  onBlur?: () => void;
  children: ReactNode;
  error?: string | null;
  required?: boolean;
};

/** Labelled checkbox (native input for accessibility, styled box). */
export function Checkbox({ checked, onChange, onBlur, children, error, required }: CheckboxProps) {
  const id = useId();
  return (
    <div>
      <div className="flex items-start gap-2.5">
        <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0">
          <input
            id={id}
            type="checkbox"
            checked={checked}
            required={required}
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => onChange(e.target.checked)}
            onBlur={onBlur}
            className="peer absolute inset-0 h-5 w-5 appearance-none rounded-[6px] border-2 border-ink-2 bg-surface checked:border-primary-strong checked:bg-primary-strong"
          />
          <Check className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 text-on-primary-strong opacity-0 peer-checked:opacity-100" strokeWidth={3} aria-hidden />
        </span>
        <label htmlFor={id} className="text-[13px] leading-snug text-ink">
          {children}
        </label>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 flex items-start gap-1.5 pl-7.5 text-[12px] text-ink">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-todo" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
