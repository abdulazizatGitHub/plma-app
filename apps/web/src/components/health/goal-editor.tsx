"use client";

import { Check, Pencil, X } from "lucide-react";
import { useId, useState } from "react";

type GoalEditorProps = {
  /** e.g. "Daily goal" or "Wake goal". */
  label: string;
  /** Current goal, as the input's string value ("10000" or "06:00"). */
  value: string;
  kind: "number" | "time";
  format: (value: string) => string;
  /** Returns an error message, or null when valid. */
  validate: (draft: string) => string | null;
  onSave: (value: string) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
};

/** Shows a goal with an Edit button; editing swaps in an input with Save/Cancel. */
export function GoalEditor({
  label,
  value,
  kind,
  format,
  validate,
  onSave,
  disabled,
  min,
  max,
  step,
}: GoalEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  function start() {
    setDraft(value);
    setError(null);
    setEditing(true);
  }

  function submit() {
    const problem = validate(draft);
    if (problem) {
      setError(problem);
      return;
    }
    onSave(draft);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-(--radius-control) bg-surface-sunken px-3.5 py-2">
        <div>
          <p className="text-xs text-ink-muted">{label}</p>
          <p className="text-sm font-semibold text-ink tabular-nums">{format(value)}</p>
        </div>
        <button
          type="button"
          onClick={start}
          disabled={disabled}
          aria-label={`Edit ${label.toLowerCase()}`}
          className="press-pop transition-token flex min-h-11 items-center gap-1.5 rounded-(--radius-control) px-3 text-sm font-semibold text-ink hover:bg-surface disabled:opacity-50"
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Edit
        </button>
      </div>
    );
  }

  return (
    <form
      className="rounded-(--radius-control) bg-surface-sunken p-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id={inputId}
          type={kind === "time" ? "time" : "number"}
          inputMode={kind === "number" ? "numeric" : undefined}
          value={draft}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setDraft(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="min-h-11 min-w-0 flex-1 rounded-(--radius-control) border border-line bg-surface px-3 text-base font-semibold text-ink tabular-nums"
        />
        <button
          type="submit"
          aria-label={`Save ${label.toLowerCase()}`}
          className="press-pop transition-token flex min-h-11 w-11 items-center justify-center rounded-(--radius-control) bg-ink text-canvas"
        >
          <Check className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Cancel"
          className="press-pop transition-token flex min-h-11 w-11 items-center justify-center rounded-(--radius-control) border border-line text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
