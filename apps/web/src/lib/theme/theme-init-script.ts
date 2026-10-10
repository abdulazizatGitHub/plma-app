import { DEFAULT_THEME_MODE, DEFAULT_THEME_NAME, MODE_STORAGE_KEY, THEME_NAMES, THEME_STORAGE_KEY } from "./theme-utils";

/**
 * Runs synchronously in <head>, before first paint, so the stored theme and
 * mode apply immediately instead of flashing the default and swapping after
 * React hydrates.
 */
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var root = document.documentElement;
    var theme = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (${JSON.stringify(THEME_NAMES)}.indexOf(theme) === -1) theme = ${JSON.stringify(DEFAULT_THEME_NAME)};
    root.setAttribute("data-theme", theme);
    var mode = localStorage.getItem(${JSON.stringify(MODE_STORAGE_KEY)}) || ${JSON.stringify(DEFAULT_THEME_MODE)};
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-mode", mode === "system" ? (prefersDark ? "dark" : "light") : mode);
  } catch (e) {}
})();`;
