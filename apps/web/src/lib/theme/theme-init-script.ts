import { DEFAULT_THEME_MODE, DEFAULT_THEME_NAME, STORAGE_KEYS, THEME_NAMES } from "./theme-utils";

/**
 * Runs synchronously in <head>, before first paint, so the correct theme
 * applies immediately instead of flashing the default and then swapping
 * once React hydrates. Kept as a plain string (not JSX) since it has to
 * run outside React entirely.
 */
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var names = ${JSON.stringify(THEME_NAMES)};
    var name = localStorage.getItem(${JSON.stringify(STORAGE_KEYS.name)});
    if (names.indexOf(name) === -1) name = ${JSON.stringify(DEFAULT_THEME_NAME)};
    var mode = localStorage.getItem(${JSON.stringify(STORAGE_KEYS.mode)}) || ${JSON.stringify(DEFAULT_THEME_MODE)};
    var accent = localStorage.getItem(${JSON.stringify(STORAGE_KEYS.accent)});
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolved = mode === "system" ? (prefersDark ? "dark" : "light") : mode;
    var root = document.documentElement;
    root.setAttribute("data-theme", name);
    root.setAttribute("data-mode", resolved);
    if (accent && /^#[0-9a-fA-F]{6}$/.test(accent)) {
      root.style.setProperty("--accent", accent);
      var lin = function (v) { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      var r = parseInt(accent.slice(1, 3), 16), g = parseInt(accent.slice(3, 5), 16), b = parseInt(accent.slice(5, 7), 16);
      var lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      root.style.setProperty("--accent-ink", lum > 0.45 ? "#171310" : "#fdfaf8");
      root.style.setProperty("--accent-text", accent);
    }
  } catch (e) {}
})();`;
