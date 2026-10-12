"use client";

import { ChevronDown, ChevronUp, Clock3, Keyboard } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

/*
 * Scroll-wheel time picker (owner, 2026-10-13): hour · minute · AM/PM, like
 * an iPhone alarm, so a time is flicked or tapped instead of typed. Values are
 * "HH:mm" (24 h) as everywhere else in the app. Each column is a spinbutton:
 * ↑/↓, PageUp/PageDown, Home/End; the mouse wheel and the ▲/▼ buttons step it.
 */

const ROW = 40;

const pad = (n: number) => String(n).padStart(2, "0");

export function to12(hhmm: string): { hour: number; minute: number; pm: boolean } {
  const [h, m] = (/^\d{2}:\d{2}$/.test(hhmm) ? hhmm : "09:00").split(":").map(Number);
  return { hour: ((h + 11) % 12) + 1, minute: m, pm: h >= 12 };
}

export function from12(hour: number, minute: number, pm: boolean): string {
  const h = (hour % 12) + (pm ? 12 : 0);
  return `${pad(h)}:${pad(minute)}`;
}

/** "6:45 PM" (empty for no value). */
export function label12(hhmm: string): string {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return "";
  const { hour, minute, pm } = to12(hhmm);
  return `${hour}:${pad(minute)} ${pm ? "PM" : "AM"}`;
}

type ColumnProps = {
  label: string;
  items: readonly string[];
  index: number;
  onSelect: (index: number) => void;
  /** Wraps around at the ends (hours, minutes); AM/PM doesn't. */
  loop?: boolean;
  /** Rows visible at once (odd). */
  visible: number;
};

function Column({ label, items, index, onSelect, loop = true, visible }: ColumnProps) {
  const box = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ours = useRef(false);

  // Keep the scroll position on the selected row when the value changes from outside.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const top = index * ROW;
    if (Math.abs(el.scrollTop - top) < 2) return;
    ours.current = true;
    if (typeof el.scrollTo === "function") el.scrollTo({ top, behavior: "smooth" });
    else el.scrollTop = top;
    const t = setTimeout(() => (ours.current = false), 350);
    return () => clearTimeout(t);
  }, [index]);

  const step = (delta: number) => {
    const n = items.length;
    const next = loop ? (index + delta + n * 10) % n : Math.max(0, Math.min(n - 1, index + delta));
    if (next !== index) onSelect(next);
  };

  const onKey = (e: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowUp: () => step(-1),
      ArrowDown: () => step(1),
      PageUp: () => step(-3),
      PageDown: () => step(3),
      Home: () => onSelect(0),
      End: () => onSelect(items.length - 1),
    };
    const run = keys[e.key];
    if (!run) return;
    e.preventDefault();
    run();
  };

  return (
    <div className="flex flex-col items-center">
      <button type="button" tabIndex={-1} aria-hidden onClick={() => step(-1)} className="flex h-7 w-full items-center justify-center text-ink-2 hover:text-ink">
        <ChevronUp className="h-4 w-4" />
      </button>
      <div
        ref={box}
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={index}
        aria-valuemin={0}
        aria-valuemax={items.length - 1}
        aria-valuetext={items[index]}
        onKeyDown={onKey}
        onScroll={(e) => {
          if (ours.current) return;
          const el = e.currentTarget;
          if (settle.current) clearTimeout(settle.current);
          settle.current = setTimeout(() => {
            const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ROW)));
            if (i !== index) onSelect(i);
          }, 90);
        }}
        className="no-scrollbar relative w-16 snap-y snap-mandatory overflow-y-scroll overscroll-contain rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary-strong"
        style={{ height: ROW * visible, paddingBlock: ROW * Math.floor(visible / 2) }}
      >
        {items.map((it, i) => (
          <div
            key={it}
            role="presentation"
            onClick={() => onSelect(i)}
            className={`flex cursor-pointer snap-center items-center justify-center text-[20px] tabular-nums transition-[color,transform] select-none ${
              i === index ? "font-semibold text-ink" : "text-ink-2 opacity-60"
            }`}
            style={{ height: ROW }}
          >
            {it}
          </div>
        ))}
      </div>
      <button type="button" tabIndex={-1} aria-hidden onClick={() => step(1)} className="flex h-7 w-full items-center justify-center text-ink-2 hover:text-ink">
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}

/** 12, 1, 2 … 11 — the order a clock face reads. */
const HOURS = ["12", ...Array.from({ length: 11 }, (_, i) => String(i + 1))];

export function TimeWheel({ value, onChange, minuteStep = 5, rows = 5 }: { value: string; onChange: (hhmm: string) => void; minuteStep?: number; rows?: 3 | 5 }) {
  const { hour, minute, pm } = to12(value);
  // Minutes on the step, plus the current one if it's between steps (e.g. a prayer at 5:13).
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);
  if (!minutes.includes(minute)) minutes.push(minute);
  minutes.sort((a, b) => a - b);
  return (
    <div className="relative flex items-center justify-center gap-1" role="group" aria-label="Time">
      {/* The selection band behind the middle row. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-2 top-1/2 h-10 -translate-y-1/2 rounded-xl bg-track" />
      <div className="relative">
        <Column label="Hour" visible={rows} items={HOURS} index={hour % 12} onSelect={(i) => onChange(from12(i === 0 ? 12 : i, minute, pm))} />
      </div>
      <span aria-hidden className="relative text-[20px] font-semibold text-ink">
        :
      </span>
      <div className="relative">
        <Column label="Minute" visible={rows} items={minutes.map(pad)} index={minutes.indexOf(minute)} onSelect={(i) => onChange(from12(hour, minutes[i], pm))} />
      </div>
      <div className="relative">
        <Column label="AM or PM" visible={rows} items={["AM", "PM"]} index={pm ? 1 : 0} loop={false} onSelect={(i) => onChange(from12(hour, minute, i === 1))} />
      </div>
    </div>
  );
}

type TimeFieldProps = {
  label: string;
  /** "HH:mm", or "" when optional and unset. */
  value: string;
  onChange: (hhmm: string) => void;
  /** Can be cleared back to "no time". */
  optional?: boolean;
  /** Shown when there's no value. */
  placeholder?: string;
  /** Where the wheel starts when there's no value. */
  start?: string;
  minuteStep?: number;
  error?: string | null;
  /** Hide the visible label (the context names it). */
  hideLabel?: boolean;
  /** Compact button for tight rows (plan steps, prayer times). */
  size?: "md" | "sm";
  /** Open the wheels as a floating panel instead of pushing the layout down. */
  floating?: boolean;
};

/**
 * A time button ("6:45 PM") that opens the wheels right below it, with Done
 * and (optional fields) Clear. "Type it" swaps in a plain input for anyone who
 * prefers the keyboard; typing is never needed.
 */
export function TimeField({ label, value, onChange, optional, placeholder = "Set time", start = "09:00", minuteStep = 5, error, hideLabel, size = "md", floating }: TimeFieldProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState(value || start);
  const shown = label12(value);
  return (
    <div className={floating ? "relative" : undefined}>
      {hideLabel ? null : (
        <span id={`${id}-label`} className="mb-1 block text-[12px] font-medium text-ink">
          {label}
        </span>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-label={`${label}: ${shown || "not set"}`}
        onClick={() => {
          setDraft(value || start);
          setOpen(!open);
        }}
        className={`flex items-center gap-2 border bg-surface ${size === "sm" ? "h-8 min-w-24 rounded-[10px] px-2 text-[12.5px]" : "h-10 min-w-32 rounded-[12px] px-3 text-[14px]"} ${shown ? "text-ink" : "text-ink-2"} ${
          error ? "border-todo" : "border-border"
        } hover:border-primary-strong`}
      >
        <Clock3 className="h-4 w-4 text-ink-2" aria-hidden />
        {shown || placeholder}
      </button>
      {error ? (
        <p role="alert" className="mt-1 text-[12px] text-todo">
          {error}
        </p>
      ) : null}
      {open ? (
        <div
          id={`${id}-panel`}
          className={`mt-2 rounded-2xl border border-border bg-surface p-2 ${floating ? "absolute right-0 z-30 w-64 shadow-[0_12px_32px_rgb(27_26_34/18%)]" : ""}`}
        >
          {typing ? (
            <input
              type="time"
              aria-label={label}
              value={draft}
              onChange={(e) => e.target.value && setDraft(e.target.value)}
              className="h-10 w-full rounded-[12px] border border-border bg-surface px-3 text-[14px] text-ink"
            />
          ) : (
            <TimeWheel value={draft} onChange={setDraft} minuteStep={minuteStep} />
          )}
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={() => setTyping(!typing)} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[12px] text-ink-2 hover:bg-track">
              <Keyboard className="h-3.5 w-3.5" aria-hidden /> {typing ? "Use wheels" : "Type it"}
            </button>
            <span className="flex-1" />
            {optional && value ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="min-h-8 rounded-full px-3 text-[12px] font-medium text-ink hover:bg-track"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
              className="min-h-8 rounded-full bg-primary-strong px-4 text-[12px] font-medium text-on-primary-strong"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
