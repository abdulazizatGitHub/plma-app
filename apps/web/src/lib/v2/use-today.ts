"use client";

import { logicalToday, nextDayEnd } from "@life/shared";
import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { useUserSettings } from "./use-day";

/**
 * Today's date as the user lives it: the calendar date, except before their
 * day-end hour (e.g. 1:30 AM with the day ending at 2 AM) it's still the
 * previous day. Kept current — a phone often leaves the app open overnight —
 * by switching at the day-end boundary and whenever the app comes back to the
 * foreground. Null on the server and until the first client render.
 */
function useLiveToday(dayEndHour: number, enabled: boolean): string | null {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => setToday((prev) => {
      const now = logicalToday(dayEndHour);
      return prev === now ? prev : now;
    });
    refresh();
    const delay = () => Math.max(1000, nextDayEnd(dayEndHour).getTime() - Date.now() + 1000);
    let timer = setTimeout(function tick() {
      refresh();
      timer = setTimeout(tick, delay());
    }, delay());
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [dayEndHour, enabled]);
  return today;
}

/** `undefined` = no provider above (tests, isolated renders): fall back to a local clock. */
const TodayContext = createContext<string | null | undefined>(undefined);

/** One shared "today" for the whole app, following the user's day-end setting. */
export function TodayProvider({ children }: { children: ReactNode }) {
  const { dayEndHour } = useUserSettings();
  const today = useLiveToday(dayEndHour ?? 0, true);
  return createElement(TodayContext.Provider, { value: today }, children);
}

export function useToday(): string | null {
  const shared = useContext(TodayContext);
  const own = useLiveToday(0, shared === undefined);
  return shared === undefined ? own : shared;
}
