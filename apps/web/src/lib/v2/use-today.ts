"use client";

import { todayLocalDate } from "@life/shared";
import { useEffect, useState } from "react";

/** Milliseconds until the next local midnight (plus a second of slack). */
function untilMidnight(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return next.getTime() - now.getTime();
}

/**
 * Today's local date, kept current. A phone often leaves the app open
 * overnight; without this, "Today" would still be yesterday in the morning.
 * Updates at local midnight and whenever the app comes back to the foreground.
 * Null on the server and until the first client render.
 */
export function useToday(): string | null {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => setToday((prev) => {
      const now = todayLocalDate();
      return prev === now ? prev : now;
    });
    refresh();
    let timer = setTimeout(function tick() {
      refresh();
      timer = setTimeout(tick, untilMidnight());
    }, untilMidnight());
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
  }, []);
  return today;
}
