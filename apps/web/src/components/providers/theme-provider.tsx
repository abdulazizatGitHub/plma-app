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
  const [themeName, setThemeNameState] = useState<ThemeName>(
    () => readStoredTheme().name,
  );
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredTheme().mode);
  const [accent, setAccentState] = useState<string | null>(
    () => readStoredTheme().accent,
  );
  const [prefersDark, setPrefersDark] = useState(
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );

  const resolvedMode = resolveMode(mode, prefersDark);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", themeName);
    root.setAttribute("data-mode", resolvedMode);
    if (accent) {
      root.style.setProperty("--accent", accent);
      root.style.setProperty("--accent-ink", contrastInkFor(accent));
    } else {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-ink");
    }
  }, [themeName, resolvedMode, accent]);

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
