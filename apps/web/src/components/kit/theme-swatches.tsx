"use client";

import { Check } from "lucide-react";
import { THEMES, THEME_NAMES, type ThemeName } from "@/lib/theme/tokens";

/** The four reference-image themes as round swatches (primary over canvas). */
export function ThemeSwatches({ value, onChange }: { value: ThemeName; onChange: (theme: ThemeName) => void }) {
  return (
    <div role="radiogroup" aria-label="Color theme" className="grid grid-cols-4 gap-1">
      {THEME_NAMES.map((name) => {
        const t = THEMES[name];
        const primary = t.light.primary ?? "#7293f1";
        const bg = t.light.bg ?? "#f4f4f9";
        const selected = name === value;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(name)}
            className="flex flex-col items-center gap-1 rounded-[10px] p-1 text-[11px] font-medium text-ink hover:bg-track"
          >
            <span
              className={`relative flex h-8 w-8 items-center justify-center rounded-full border ${selected ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
              style={{ background: `linear-gradient(135deg, ${bg} 0 50%, ${primary} 50% 100%)`, borderColor: "var(--border)" }}
              aria-hidden
            >
              {selected ? <Check className="h-3.5 w-3.5 text-ink" strokeWidth={3} /> : null}
            </span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
