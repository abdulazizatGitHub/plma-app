"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_NAME,
  MODE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  isThemeMode,
  isThemeName,
  resolveMode,
  type ThemeMode,
  type ThemeName,
} from "@/lib/theme/theme-utils";

type ThemeState = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  mode: ThemeMode;
  resolvedMode: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

/** Color theme (Sky / Mauve / Sunset / Lavender) + mode. THEME_INIT_SCRIPT has already painted both. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Defaults on server and client so hydration matches; stored values load after mount.
  const [theme, setThemeState] = useState<ThemeName>(DEFAULT_THEME_NAME);
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [prefersDark, setPrefersDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const resolvedMode = resolveMode(mode, prefersDark);

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const storedMode = localStorage.getItem(MODE_STORAGE_KEY);
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from storage/matchMedia */
    setThemeState(isThemeName(storedTheme) ? storedTheme : DEFAULT_THEME_NAME);
    setModeState(isThemeMode(storedMode) ? storedMode : DEFAULT_THEME_MODE);
    setPrefersDark(mql.matches);
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-mode", resolvedMode);
  }, [hydrated, theme, resolvedMode]);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem(MODE_STORAGE_KEY, next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mode, resolvedMode, setMode }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
