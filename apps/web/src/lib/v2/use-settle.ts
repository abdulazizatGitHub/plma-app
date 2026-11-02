"use client";

import type { EntryState } from "@life/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

/** How long a row stays where it is after the last tap before it moves to its new section. */
export const SETTLE_MS = 2500;

type ViewTransitionDoc = Document & { startViewTransition?: (update: () => void) => unknown };

/**
 * Keeps a row in the section it was in while the user is working with it
 * (owner, 2026-10-11: rows jumped away mid-edit). Every interaction restarts
 * the row's timer; when it ends, the row moves to its real section, animated
 * with the View Transitions API where available (and when motion is allowed).
 */
export function useSettledPlacement() {
  const [held, setHeld] = useState<ReadonlyMap<string, EntryState>>(() => new Map());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => clearTimeout(t));
  }, []);

  /** Call before acting on a row; `shownIn` is the section it's in right now. */
  const hold = useCallback((key: string, shownIn: EntryState) => {
    setHeld((prev) => (prev.has(key) ? prev : new Map(prev).set(key, shownIn)));
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing);
    timers.current.set(
      key,
      setTimeout(() => {
        timers.current.delete(key);
        const release = () =>
          setHeld((prev) => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
        const doc = document as ViewTransitionDoc;
        const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (doc.startViewTransition && !calm) doc.startViewTransition(() => flushSync(release));
        else release();
      }, SETTLE_MS),
    );
  }, []);

  return { held, hold };
}

/** A CSS-safe view-transition name for a row, so its move between sections animates. */
export const rowTransitionName = (key: string) => `row-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
