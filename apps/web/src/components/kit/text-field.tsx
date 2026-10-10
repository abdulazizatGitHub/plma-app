"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string | null;
  /** Rendered inside the input on the right (e.g. a show-password button). */
  trailing?: ReactNode;
};

/** Labelled input. Required fields get a visible `*`; errors are announced via aria-describedby. */
export function TextField({ label, hint, error, trailing, required, className = "", id: idProp, ...input }: TextFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-[12px] font-medium text-ink">
        {label}
        {required ? (
          <span className="ml-0.5 text-ink-2" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <div className="relative">
        <input
          id={id}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-10 w-full rounded-[12px] border bg-surface px-3 text-[14px] text-ink outline-none placeholder:text-ink-2 focus:border-primary-strong ${
            trailing ? "pr-12" : ""
          } ${error ? "border-todo" : "border-border"}`}
          {...input}
        />
        {trailing ? <div className="absolute inset-y-0 right-0.5 flex items-center">{trailing}</div> : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-[12px] text-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 flex items-start gap-1.5 text-[12px] text-ink">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-todo" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
