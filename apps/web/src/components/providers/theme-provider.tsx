"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  contrastInkFor,
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_NAME,
  isThemeMode,
  isThemeName,
  isValidHexColor,
  resolveMode,
  STORAGE_KEYS,
  THEME_MODES,
  THEME_NAMES,
  type ThemeMode,
  type ThemeName,
} from "@/lib/theme/theme-utils";

type ThemeState = {
  themeName: ThemeName;
  mode: ThemeMode;
  resolvedMode: "light" | "dark";
  accent: string | null;
  setThemeName: (name: ThemeName) => void;
  setMode: (mode: ThemeMode) => void;
  setAccent: (hex: string | null) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

function readStoredTheme() {
  if (typeof window === "undefined") {
    return { name: DEFAULT_THEME_NAME, mode: DEFAULT_THEME_MODE, accent: null as string | null };
  }
  const storedName = localStorage.getItem(STORAGE_KEYS.name);
  const storedMode = localStorage.getItem(STORAGE_KEYS.mode);
  const storedAccent = localStorage.getItem(STORAGE_KEYS.accent);
  return {
    name: isThemeName(storedName) ? storedName : DEFAULT_THEME_NAME,
    mode: isThemeMode(storedMode) ? storedMode : DEFAULT_THEME_MODE,
    accent: storedAccent && isValidHexColor(storedAccent) ? storedAccent : null,
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start from defaults on both server and client so hydration matches; the
  // real stored values are read after mount. THEME_INIT_SCRIPT has already
  // painted the correct theme, so nothing flashes in between.
  const [themeName, setThemeNameState] = useState<ThemeName>(DEFAULT_THEME_NAME);
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [accent, setAccentState] = useState<string | null>(null);
  const [prefersDark, setPrefersDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const resolvedMode = resolveMode(mode, prefersDark);

  useEffect(() => {
    const stored = readStoredTheme();
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    // One-time sync from localStorage/matchMedia after mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    setThemeNameState(stored.name);
    setModeState(stored.mode);
    setAccentState(stored.accent);
    setPrefersDark(mql.matches);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    // Until stored values are loaded, leave the init script's attributes alone.
    if (!hydrated) return;
    const root = document.documentElement;
    root.setAttribute("data-theme", themeName);
    root.setAttribute("data-mode", resolvedMode);
    if (accent) {
      root.style.setProperty("--accent", accent);
      root.style.setProperty("--accent-ink", contrastInkFor(accent));
      root.style.setProperty("--accent-text", accent);
    } else {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-ink");
      root.style.removeProperty("--accent-text");
    }
  }, [hydrated, themeName, resolvedMode, accent]);

  const setThemeName = useCallback((name: ThemeName) => {
    setThemeNameState(name);
    localStorage.setItem(STORAGE_KEYS.name, name);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEYS.mode, next);
  }, []);

  const setAccent = useCallback((hex: string | null) => {
    setAccentState(hex);
    if (hex) localStorage.setItem(STORAGE_KEYS.accent, hex);
    else localStorage.removeItem(STORAGE_KEYS.accent);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ themeName, mode, resolvedMode, accent, setThemeName, setMode, setAccent }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export { THEME_MODES, THEME_NAMES };
