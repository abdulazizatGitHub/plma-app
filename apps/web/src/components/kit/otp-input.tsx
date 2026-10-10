"use client";

import { useId, useRef, useState } from "react";
import { sanitizeDigits } from "@/lib/forms/validators";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  label?: string;
  error?: string | null;
  autoFocus?: boolean;
};

/**
 * One-time code entry: a single real input (digits only, paste and SMS/email
 * autofill friendly) drawn as separate boxes.
 */
export function OtpInput({ value, onChange, length = 6, label = "Verification code", error, autoFocus }: OtpInputProps) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[12px] font-medium text-ink">
        {label}
      </label>
      <div className="relative" onClick={() => ref.current?.focus()}>
        <input
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(sanitizeDigits(e.target.value, length))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern={`\\d{${length}}`}
          maxLength={length}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
        />
        <div className="flex justify-between gap-2" aria-hidden>
          {Array.from({ length }, (_, i) => {
            const active = i === Math.min(value.length, length - 1);
            return (
              <span
                key={i}
                className={`flex h-12 flex-1 items-center justify-center rounded-[12px] border-2 bg-surface text-xl font-semibold text-ink ${
                  error ? "border-todo" : active && focused ? "border-primary-strong" : "border-border"
                }`}
              >
                {value[i] ?? ""}
              </span>
            );
          })}
        </div>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1.5 text-[13px] text-ink">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-todo" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
