"use client";

import { Check } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { THEME_MODES, THEME_NAMES } from "@/lib/theme/theme-utils";

/** Canvas + accent of each preset's signature palette (see globals.css). */
const THEME_SWATCHES: Record<
  (typeof THEME_NAMES)[number],
  { label: string; source: string; canvas: string; accent: string }
> = {
  clay: { label: "Clay", source: "by-kin", canvas: "#f4f2ed", accent: "#ff6542" },
  volt: { label: "Volt", source: "Lusion", canvas: "#f0f1fa", accent: "#1a2ffb" },
  studio: { label: "Studio", source: "Iventions", canvas: "#f3efeb", accent: "#8072ff" },
  ember: { label: "Ember", source: "Minh Pham", canvas: "#0d0d0d", accent: "#eb5939" },
};

const MODE_LABELS: Record<(typeof THEME_MODES)[number], string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemePicker() {
  const { themeName, mode, accent, setThemeName, setMode, setAccent } = useTheme();

  return (
    <div className="mt-3 space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Mode</p>
        <div className="flex gap-1.5 rounded-(--radius-control) bg-surface-sunken p-1">
          {THEME_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`press-pop transition-token min-h-10 flex-1 rounded-(--radius-chip) text-sm font-medium ${
                mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-muted"
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink">Theme</p>
        <div className="grid grid-cols-2 gap-2">
          {THEME_NAMES.map((name) => {
            const { label, source, canvas, accent: swatch } = THEME_SWATCHES[name];
            const active = themeName === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setThemeName(name)}
                aria-pressed={active}
                className={`press-pop transition-token flex items-center gap-3 rounded-(--radius-control) border p-2.5 text-left ${
                  active ? "border-ink bg-surface-sunken" : "border-line"
                }`}
              >
                <span
                  className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-line"
                  style={{ backgroundColor: canvas }}
                  aria-hidden
                >
                  <span
                    className="absolute inset-y-0 right-0 w-1/2"
                    style={{ backgroundColor: swatch }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{label}</span>
                  <span className="label-mono block text-ink-muted">{source}</span>
                </span>
                {active ? <Check className="h-4 w-4 text-ink" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">Accent color</p>
          <p className="text-xs text-ink-muted">Overrides the theme&apos;s accent everywhere</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Custom accent color"
            value={accent ?? THEME_SWATCHES[themeName].accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-10 w-10 cursor-pointer rounded-(--radius-chip) border border-line bg-transparent p-0.5"
          />
          {accent ? (
            <button
              type="button"
              onClick={() => setAccent(null)}
              className="text-sm font-medium text-accent-text hover:opacity-80"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
