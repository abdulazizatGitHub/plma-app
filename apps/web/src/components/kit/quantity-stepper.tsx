"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { MAX_QUANTITY, sanitizeDigits } from "@/lib/forms/validators";
import type { ItemState } from "./status-tile";
import { TaskRow, type Priority } from "./task-row";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Parses typed input like "10,000" or " 750 "; null when not a number. */
export function parseQuantity(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

type QuantityStepperProps = {
  value: number;
  onChange: (next: number) => void;
  /** Amount per − / + tap (e.g. 500 for steps). */
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  /** Accessible name of the quantity, e.g. "Steps". */
  label: string;
};

/** − [value] + ; tap the value to type it directly (owner: "10,000 directly, or ±500"). */
export function QuantityStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = MAX_QUANTITY,
  unit,
  label,
}: QuantityStepperProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const commit = () => {
    const parsed = parseQuantity(draft);
    if (parsed !== null) onChange(clamp(parsed));
    setEditing(false);
  };

  return (
    // Holding − / + must not trigger the row's long-press menu.
    <div className="flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`Decrease ${label} by ${fmt(step)}`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        className="press-pop inline-flex h-9 w-9 items-center justify-center rounded-full bg-track text-ink disabled:opacity-40"
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      {editing ? (
        <input
          autoFocus
          inputMode="numeric"
          aria-label={`${label} value`}
          value={draft}
          // Numbers only: anything else is dropped as it is typed.
          onChange={(e) => setDraft(sanitizeDigits(e.target.value))}
          pattern="\d*"
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-9 w-24 rounded-[10px] border border-border bg-surface text-center text-[14px] font-semibold text-ink outline-none focus:border-primary-strong"
        />
      ) : (
        <button
          type="button"
          aria-label={`${label}: ${fmt(value)}${unit ? ` ${unit}` : ""}. Tap to type a value`}
          onClick={() => {
            setDraft(String(value));
            setEditing(true);
          }}
          className="h-9 min-w-24 rounded-[10px] px-2 text-center text-[14px] font-semibold text-ink hover:bg-track"
        >
          {fmt(value)}
          {unit ? <span className="ml-1 text-[12px] font-normal text-ink-2">{unit}</span> : null}
        </button>
      )}
      <button
        type="button"
        aria-label={`Increase ${label} by ${fmt(step)}`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        className="press-pop inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-strong text-on-primary-strong disabled:opacity-40"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

/** Derives the status bucket of a quantity: 0 → To Do, partial → In Progress, ≥ target → Done. */
export function quantityState(value: number, target?: number): ItemState {
  if (target !== undefined && value >= target) return "done";
  return value > 0 ? "in_progress" : "todo";
}

type QuantityRowProps = Omit<QuantityStepperProps, "label"> & {
  title: string;
  target?: number;
  meta?: string;
  priority?: Priority;
  categoryColor?: string;
  onOpen?: () => void;
  onMore?: (anchor: HTMLElement) => void;
  tags?: React.ReactNode;
  highlight?: boolean;
  /** A day that can't be logged: no stepper, just the value. */
  readOnly?: boolean;
  /** Being edited right now: keep the stepper open even once the goal is reached. */
  active?: boolean;
  /**
   * Compact (Today's grouped list): one round + on the right logs a step;
   * tap the progress bar for the full − / + (owner, 2026-10-13: less clutter).
   */
  compact?: boolean;
  badges?: React.ReactNode;
};

/** Task row for counted items: title, "4,000 / 10,000 steps", thin progress line, stepper. */
export function QuantityRow({ title, target, meta, priority, categoryColor, onOpen, onMore, tags, highlight, readOnly = false, active = false, compact = false, badges, ...stepper }: QuantityRowProps) {
  const state = quantityState(stepper.value, target);
  const pct = target ? Math.min(100, (stepper.value / target) * 100) : 0;
  // A reached goal folds its stepper away; "Log more" brings it back (extra effort still counts).
  const [logMore, setLogMore] = useState(false);
  const reached = state === "done";
  // Never fold mid-tap: a row still being edited keeps its stepper until it settles.
  const showStepper = !readOnly && (compact ? logMore : !reached || logMore || active);
  const progress = target
    ? reached
      ? `Goal reached · ${fmt(stepper.value)}${stepper.unit ? ` ${stepper.unit}` : ""}`
      : `${fmt(stepper.value)} / ${fmt(target)}${stepper.unit ? ` ${stepper.unit}` : ""}`
    : `${fmt(stepper.value)}${stepper.unit ? ` ${stepper.unit}` : ""}`;
  const caption = [
    compact ? meta : target ? `${fmt(stepper.value)} / ${fmt(target)}${stepper.unit ? ` ${stepper.unit}` : ""}` : null,
    compact ? progress : meta,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <TaskRow
      title={title}
      meta={caption}
      state={state}
      priority={priority}
      categoryColor={categoryColor}
      onToggle={target ? () => stepper.onChange(state === "done" ? 0 : target) : undefined}
      onOpen={onOpen}
      onMore={onMore}
      tags={tags}
      highlight={highlight}
      readOnly={readOnly}
      flat={compact}
      badges={badges}
      aside={
        compact && !readOnly && !reached ? (
          <button
            type="button"
            aria-label={`Increase ${title} by ${fmt(stepper.step ?? 1)}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => stepper.onChange(Math.min(stepper.max ?? MAX_QUANTITY, stepper.value + (stepper.step ?? 1)))}
            className="press-pop mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-strong text-on-primary-strong"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        ) : undefined
      }
    >
      {target && compact && !readOnly ? (
        // The bar is the way into the full − / + (and typing a value).
        <button
          type="button"
          aria-expanded={showStepper}
          aria-label={`Adjust ${title}: ${fmt(stepper.value)} of ${fmt(target)}`}
          onClick={() => setLogMore((v) => !v)}
          onPointerDown={(e) => e.stopPropagation()}
          className="block w-full py-1.5"
        >
          <span className="block h-1.5 overflow-hidden rounded-full bg-track">
            <span className={`block h-full rounded-full transition-[width] duration-(--duration-base) ${reached ? "bg-done" : "bg-primary"}`} style={{ width: `${pct}%` }} />
          </span>
        </button>
      ) : target ? (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-track" aria-hidden>
          <div className={`h-full rounded-full transition-[width] duration-(--duration-base) ${reached ? "bg-done" : "bg-primary"}`} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      {showStepper ? (
        <div className="mt-1.5 flex items-center gap-2">
          <QuantityStepper label={title} {...stepper} />
          {reached ? (
            <button type="button" onClick={() => setLogMore(false)} className="min-h-8 rounded-full px-2 text-[12px] font-medium text-ink-2 hover:bg-track">
              Done
            </button>
          ) : null}
        </div>
      ) : reached && !readOnly && !compact ? (
        <button type="button" onClick={() => setLogMore(true)} className="mt-1 min-h-8 rounded-full px-1 text-[12px] font-medium text-link">
          Log more
        </button>
      ) : null}
    </TaskRow>
  );
}
