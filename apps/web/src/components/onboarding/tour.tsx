"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/components/providers/store-provider";
import { TOUR_KEY } from "./onboarding-gate";

type TourStep = { target: string; title: string; body: string };

/** First-run tips on Today (owner, 2026-10-11): each points at the real control. */
export const TOUR_STEPS: TourStep[] = [
  { target: "ring", title: "Your day at a glance", body: "The ring fills as you finish today's items. Skipped or moved items don't count against you." },
  {
    target: "prayers",
    title: "Your prayers",
    body: "Tap a prayer once you've prayed it — in any order. Hold one (or use ⋯) for prayed late (qada) or missed.",
  },
  { target: "tiles", title: "To Do · In Progress · Done", body: "Tap a tile to see only those items. Tap it again to see everything." },
  {
    target: "list",
    title: "Mark things done",
    body: "Tap the circle to finish an item and use − / + for counts. ⋯ skips it, moves it to another day or edits it. Tap a title to see its history.",
  },
  { target: "add", title: "Add anything", body: "+ adds a task for today or any day. “More options” makes habits, counts, checklists and routines." },
  { target: "nav:/categories", title: "Your categories", body: "Organise, reorder or archive your areas, and add more interests any time." },
];

const PAD = 6;
const GAP = 10;
const EDGE = 12;
const CARD_W = 300;

/** The visible element marked data-tour="…" (phone and desktop have different navs). */
function findTarget(name: string): HTMLElement | null {
  const all = [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)];
  return all.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }) ?? null;
}

/**
 * Spotlight tour: dims the screen except the current control, with a small
 * card that explains it. Shown once after setup; Profile can replay it.
 */
export function Tour({ ready }: { ready: boolean }) {
  const { store } = useStore();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [steps, setSteps] = useState<TourStep[]>([]);

  useEffect(() => {
    if (!ready || !store || store.getMeta(TOUR_KEY) !== "pending") return;
    // Only the steps whose control is on screen right now.
    setSteps(TOUR_STEPS.filter((s) => findTarget(s.target))); // eslint-disable-line react-hooks/set-state-in-effect -- reads the DOM once ready
    setOpen(true);
  }, [ready, store]);

  const close = useCallback(() => {
    store?.setMeta(TOUR_KEY, "done");
    void store?.flush(); // persist now, so a quick reload doesn't bring the tour back
    setOpen(false);
  }, [store]);

  const step = steps[index];
  const measure = useCallback(() => {
    const el = step ? findTarget(step.target) : null;
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    findTarget(step.target)?.scrollIntoView({ block: "center" });
    measure(); // eslint-disable-line react-hooks/set-state-in-effect -- positions the spotlight from layout
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, step, measure, close]);

  if (!open || !step || !rect) return null;
  const last = index === steps.length - 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_W, vw - EDGE * 2);
  const left = Math.min(Math.max(EDGE, rect.left + rect.width / 2 - width / 2), vw - width - EDGE);
  const below = rect.bottom + PAD + GAP;
  const placeBelow = below + 180 < vh || rect.top < vh / 2;
  const cardStyle = placeBelow ? { top: Math.min(below, vh - 200), left, width } : { bottom: vh - rect.top + PAD + GAP, left, width };

  return createPortal(
    <div className="fixed inset-0 z-60">
      {/* Blocks taps on the app underneath while the tour is open. */}
      <div className="absolute inset-0" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none fixed rounded-2xl transition-all duration-(--duration-base)"
        style={{
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
          boxShadow: "0 0 0 9999px rgb(27 26 34 / 55%)",
        }}
      />
      <div role="dialog" aria-modal="true" aria-label="App tour" className="card fixed space-y-2 p-3.5 shadow-[0_12px_32px_rgb(27_26_34/25%)]" style={cardStyle}>
        <p className="text-[11px] font-medium text-ink-2">
          {index + 1} of {steps.length}
        </p>
        <h2 className="text-[15px] font-semibold text-ink">{step.title}</h2>
        <p className="text-[13px] leading-snug text-ink-2">{step.body}</p>
        <div className="flex items-center gap-1.5 pt-1">
          <button type="button" onClick={close} className="min-h-8 rounded-full px-2 text-[12px] font-medium text-ink-2 hover:text-ink">
            Skip tour
          </button>
          <span className="flex-1" />
          {index > 0 ? (
            <button type="button" onClick={() => setIndex((i) => i - 1)} className="min-h-8 rounded-full bg-track px-3 text-[12px] font-medium text-ink hover:bg-border">
              Back
            </button>
          ) : null}
          <button
            type="button"
            autoFocus
            onClick={() => (last ? close() : setIndex((i) => i + 1))}
            className="min-h-8 rounded-full bg-primary-strong px-3.5 text-[12px] font-semibold text-on-primary-strong"
          >
            {last ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
