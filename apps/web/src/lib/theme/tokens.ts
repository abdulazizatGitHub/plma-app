/**
 * v2 color tokens — the TypeScript mirror of `app/globals.css`. Sampled from
 * the owner's reference images (`UI Images/`); `(d)` values are derived.
 * See docs/design/DESIGN_SYSTEM_V2.md. `tokens.test.ts` keeps both in sync and
 * checks every text/background pair the UI kit uses against WCAG AA.
 */
export const LIGHT = {
  bg: "#f4f4f9",
  surface: "#ffffff",
  track: "#e5e5ef",
  border: "#dbdce3",
  ink: "#1b1a22",
  "ink-2": "#64656c",
  todo: "#e66473",
  progress: "#ebac80",
  done: "#97bb7d",
  muted: "#aa8b9a",
  primary: "#7293f1",
  "primary-strong": "#4766d0",
  link: "#4766d0",
  "on-primary-strong": "#ffffff",
  "on-fill": "#1b1a22",
} as const;

export const DARK = {
  ...LIGHT,
  bg: "#1b1a22",
  surface: "#25242e",
  track: "#2f2e3a",
  border: "#3a3946",
  ink: "#f4f4f9",
  "ink-2": "#a9aab4",
  link: "#7293f1",
} as const;

export type TokenName = keyof typeof LIGHT;
type Palette = Record<TokenName, string>;

export const THEME_NAMES = ["sky", "mauve", "sunset", "lavender"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

/**
 * One theme per owner reference image. Overrides on top of LIGHT/DARK;
 * mirrors the `[data-theme=…]` blocks in globals.css.
 */
export const THEMES: Record<ThemeName, { label: string; source: string; light: Partial<Palette>; dark: Partial<Palette> }> = {
  sky: { label: "Sky", source: "ref 1", light: {}, dark: {} },
  mauve: {
    label: "Mauve",
    source: "ref 2",
    light: { primary: "#aa8b9a", "primary-strong": "#906a7d", link: "#896476" },
    dark: { primary: "#aa8b9a", "primary-strong": "#906a7d", link: "#aa8b9a" },
  },
  sunset: {
    label: "Sunset",
    source: "ref 3",
    light: { bg: "#fff9eb", primary: "#2e9499", "primary-strong": "#287f83", link: "#277d81" },
    dark: { primary: "#2e9499", "primary-strong": "#287f83", link: "#309ca1" },
  },
  lavender: {
    label: "Lavender",
    source: "ref 4",
    light: { bg: "#f0e6e7", primary: "#927ab3", "primary-strong": "#5d477c", link: "#5d477c" },
    dark: { primary: "#927ab3", "primary-strong": "#5d477c", link: "#9a85b9" },
  },
};

export function palette(theme: ThemeName, mode: "light" | "dark"): Palette {
  return mode === "light" ? { ...LIGHT, ...THEMES[theme].light } : { ...DARK, ...THEMES[theme].dark };
}

/** [foreground, background] pairs that carry text in the kit. */
export const TEXT_PAIRS: [TokenName, TokenName][] = [
  ["ink", "bg"],
  ["ink", "surface"],
  ["ink-2", "bg"],
  ["ink-2", "surface"],
  ["on-fill", "todo"],
  ["on-fill", "progress"],
  ["on-fill", "done"],
  ["on-fill", "muted"],
  ["on-fill", "primary"],
  ["on-primary-strong", "primary-strong"],
  ["link", "bg"],
  ["link", "surface"],
];

/** Category pastels for category chips/cards (fills only, ink text on top). */
export const CATEGORY_TONES = [
  "mint",
  "lilac",
  "peach",
  "lime",
  "pink",
  "sky",
  "teal",
  "yellow",
] as const;
export type CategoryTone = (typeof CATEGORY_TONES)[number];

/** Saturated tones stay the same in dark mode, so they keep dark ink on top. */
export const toneInkClass = (tone: CategoryTone) => (tone === "sky" || tone === "teal" || tone === "yellow" ? "text-on-fill" : "text-ink");
