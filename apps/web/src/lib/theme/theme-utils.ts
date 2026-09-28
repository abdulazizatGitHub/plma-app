export const THEME_NAMES = ["rose", "slate", "sage", "lavender"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const DEFAULT_THEME_NAME: ThemeName = "rose";
export const DEFAULT_THEME_MODE: ThemeMode = "system";

export const STORAGE_KEYS = {
  name: "life_theme_name",
  mode: "life_theme_mode",
  accent: "life_theme_accent",
} as const;

export function isThemeName(value: string | null): value is ThemeName {
  return value !== null && (THEME_NAMES as readonly string[]).includes(value);
}

export function isThemeMode(value: string | null): value is ThemeMode {
  return value !== null && (THEME_MODES as readonly string[]).includes(value);
}

export function resolveMode(mode: ThemeMode, prefersDark: boolean): "light" | "dark" {
  return mode === "system" ? (prefersDark ? "dark" : "light") : mode;
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value);
}

/**
 * WCAG relative luminance of an sRGB hex color, used to decide whether
 * light or dark text reads best on top of it.
 */
export function relativeLuminance(hex: string): number {
  if (!isValidHexColor(hex)) return 0;
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Picks a readable ink color for text/icons drawn on top of `accentHex`. */
export function contrastInkFor(accentHex: string): string {
  if (!isValidHexColor(accentHex)) return "#111111";
  return relativeLuminance(accentHex) > 0.45 ? "#171310" : "#fdfaf8";
}
