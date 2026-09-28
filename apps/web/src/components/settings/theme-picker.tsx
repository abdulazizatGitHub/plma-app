"use client";

import { Check } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { THEME_MODES, THEME_NAMES } from "@/lib/theme/theme-utils";

const THEME_SWATCHES: Record<(typeof THEME_NAMES)[number], { label: string; swatch: string }> = {
  rose: { label: "Rose", swatch: "#9c3b4e" },
  slate: { label: "Slate", swatch: "#3e5c56" },
  sage: { label: "Sage", swatch: "#55703a" },
  lavender: { label: "Lavender", swatch: "#5b4b8a" },
};

const MODE_LABELS: Record<(typeof THEME_MODES)[number], string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemePicker() {
  const { themeName, mode, accent, setThemeName, setMode, setAccent } = useTheme();

  return (
    <div className="mt-3 space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium text-ink-muted">Appearance</p>
        <div className="flex gap-1.5 rounded-xl bg-surface-sunken p-1">
          {THEME_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-muted"
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-ink-muted">Theme</p>
        <div className="grid grid-cols-4 gap-2">
          {THEME_NAMES.map((name) => {
            const { label, swatch } = THEME_SWATCHES[name];
            const active = themeName === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setThemeName(name)}
                aria-pressed={active}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2"
                  style={{
                    backgroundColor: swatch,
                    borderColor: active ? swatch : "transparent",
                    outline: active ? `2px solid ${swatch}` : undefined,
                    outlineOffset: active ? 2 : undefined,
                  }}
                >
                  {active ? <Check className="h-4 w-4" style={{ color: "#fff" }} /> : null}
                </span>
                <span className="text-[11px] text-ink-muted">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-ink-muted">Accent color</p>
          <p className="text-[11px] text-ink-muted/80">Overrides the theme&apos;s accent everywhere</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Custom accent color"
            value={accent ?? THEME_SWATCHES[themeName].swatch}
            onChange={(e) => setAccent(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
          />
          {accent ? (
            <button
              type="button"
              onClick={() => setAccent(null)}
              className="text-xs font-medium text-accent hover:opacity-80"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
