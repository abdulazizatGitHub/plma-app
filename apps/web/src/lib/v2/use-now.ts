"use client";

import { useEffect, useState } from "react";

/** The current time, refreshed every minute (for "now" highlights and countdowns). */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
