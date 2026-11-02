"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Sheet } from "./sheet";

/**
 * A long list to choose one from (e.g. 12 prayer-time methods), replacing the
 * browser's dropdown (owner, 2026-10-13). The button shows the choice; the
 * sheet lists every option; one tap picks and closes.
 */
export function ChoiceSheet<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <div>
      <span className="mb-1 block text-[12px] font-medium text-ink">{label}</span>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`${label}: ${current?.label ?? "choose"}`}
        onClick={() => setOpen(true)}
        className="flex min-h-10 w-full items-center gap-2 rounded-[12px] border border-border bg-surface px-3 text-left text-[14px] text-ink hover:border-primary-strong"
      >
        <span className="min-w-0 flex-1">{current?.label ?? "Choose"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label}>
        <ul role="radiogroup" aria-label={label} className="-mx-1 space-y-0.5">
          {options.map((o) => {
            const on = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left ${on ? "bg-track" : "hover:bg-track"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[14px] ${on ? "font-semibold text-ink" : "text-ink"}`}>{o.label}</span>
                    {o.hint ? <span className="block text-[12px] text-ink-2">{o.hint}</span> : null}
                  </span>
                  {on ? <Check className="h-4.5 w-4.5 shrink-0 text-primary-strong" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </div>
  );
}

/**
 * Keeps a page's main actions (Save / Finish) in reach while the form above
 * scrolls: pinned just above the bottom bar on phones, at the bottom on desktop.
 */
export function StickyActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-30 -mx-4 border-t border-border bg-bg/95 px-4 pt-2.5 pb-2 backdrop-blur md:-mx-6 md:px-6 lg:bottom-0">
      {children}
    </div>
  );
}
