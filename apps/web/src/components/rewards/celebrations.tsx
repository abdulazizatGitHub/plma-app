"use client";

import { PERFECT_DAY_BONUS, RING_LABEL, RING_ORDER, awardDef, dayRings, entryState, unitPoints, type DayEntry, type RingKind } from "@life/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Sheet } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { useDay, useUserSettings } from "@/lib/v2/use-day";
import { useRewards } from "@/lib/v2/use-rewards";
import { useToday } from "@/lib/v2/use-today";
import { ShareSheet, type ShareWhat } from "@/components/social/share-sheet";
import { AWARD_ICON, AWARD_TONE } from "./rewards-panel";

/** A completion counts as the user's own when it follows a tap this quickly (not a sync from another device). */
const TAP_MS = 1500;
const CONFETTI = ["var(--cat-peach)", "var(--cat-lilac)", "var(--cat-mint)", "var(--cat-yellow)", "var(--cat-sky)", "var(--cat-pink)"];

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

type Pop = { id: number; x: number; y: number; points: number };

/**
 * Celebrations (Phase 8, owner 2026-10-14; rings 2026-10-15): subtle for
 * items, bigger for milestones. A done item floats "+3" from where it was
 * tapped; a ring closing gets a toast; closing every ring bursts a little
 * confetti; a new award gets its own card, once. With reduced motion there's
 * no movement, just toasts.
 */
export function Celebrations() {
  const today = useToday();
  const day = useDay(today ?? "1970-01-01");
  const { notify } = useAddSheet();
  const { rewards, markSeen } = useRewards();
  const settings = useUserSettings();
  const [pops, setPops] = useState<Pop[]>([]);
  const [confetti, setConfetti] = useState(0);
  const [share, setShare] = useState<ShareWhat | null>(null);
  const tap = useRef({ x: 0, y: 0, at: 0 });
  const prev = useRef<{ date: string; done: Set<string>; closed: Set<RingKind>; complete: boolean } | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const onDown = (e: PointerEvent) => (tap.current = { x: e.clientX, y: e.clientY, at: Date.now() });
    window.addEventListener("pointerdown", onDown, { capture: true });
    return () => window.removeEventListener("pointerdown", onDown, { capture: true });
  }, []);

  const units = useMemo(() => day.entries.flatMap((e: DayEntry) => e.children ?? [e]), [day.entries]);
  const rings = useMemo(() => dayRings(day.entries, today ?? "1970-01-01", false, settings), [day.entries, today, settings]);

  useEffect(() => {
    if (!today || !day.ready) return;
    const done = new Set(units.filter((u) => entryState(u) === "done").map((u) => u.key));
    const closed = new Set(RING_ORDER.filter((k) => rings[k]?.closed));
    const before = prev.current;
    prev.current = { date: today, done, closed, complete: rings.complete };
    if (!before || before.date !== today) return; // first look at this day: nothing to celebrate
    if (Date.now() - tap.current.at > TAP_MS) return; // not the user's own tap (e.g. a sync)
    const points = units.filter((u) => done.has(u.key) && !before.done.has(u.key)).reduce((n, u) => n + unitPoints(u.item, u.occurrence, true), 0);
    const allClosed = rings.complete && !before.complete;
    const ring = RING_ORDER.find((k) => closed.has(k) && !before.closed.has(k));
    const calm = reducedMotion();
    if (points > 0 && !calm) {
      const pop = { id: ++seq.current, x: tap.current.x, y: tap.current.y, points };
      setPops((p) => [...p, pop]);
      setTimeout(() => setPops((p) => p.filter((x) => x.id !== pop.id)), 1000);
    }
    if (allClosed) {
      if (!calm) setConfetti(Date.now());
      notify({ message: rings.perfect ? `Every ring closed — perfect day, +${PERFECT_DAY_BONUS}` : "Every ring closed — day complete" });
    } else if (ring) notify({ message: `${RING_LABEL[ring]} ring closed` });
    else if (points > 0 && calm) notify({ message: `+${points} point${points === 1 ? "" : "s"}` });
  }, [today, day.ready, units, rings, notify]);

  useEffect(() => {
    if (!confetti) return;
    const t = setTimeout(() => setConfetti(0), 1400);
    return () => clearTimeout(t);
  }, [confetti]);

  // A new badge: its own card, once.
  const unseen = rewards?.badges.filter((b) => !b.seen && awardDef(b.id)) ?? [];
  const badge = unseen.length ? awardDef(unseen[0].id) : null;
  const closeBadge = () => void markSeen(unseen.map((b) => b.id));
  const more = unseen.length - 1;

  return (
    <>
      {pops.map((p) => (
        <span
          key={p.id}
          aria-hidden
          className="points-pop pointer-events-none fixed z-[60] -translate-x-1/2 rounded-full bg-done px-2 py-0.5 text-[12px] font-semibold text-on-fill shadow-sm"
          style={{ left: p.x, top: p.y - 18 }}
        >
          +{p.points}
        </span>
      ))}
      {confetti ? (
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center overflow-hidden" style={{ height: "60vh" }}>
          {Array.from({ length: 28 }, (_, i) => (
            <span
              key={`${confetti}-${i}`}
              className="confetti-piece absolute top-0 h-2.5 w-1.5 rounded-[2px]"
              style={{
                left: `${8 + ((i * 37) % 84)}%`,
                background: CONFETTI[i % CONFETTI.length],
                animationDelay: `${(i % 7) * 40}ms`,
                ["--drift" as string]: `${((i * 53) % 120) - 60}px`,
                ["--spin" as string]: `${(i % 2 ? 1 : -1) * (240 + ((i * 29) % 300))}deg`,
              }}
            />
          ))}
        </div>
      ) : null}
      {badge ? (
        <Sheet open onClose={closeBadge} title="New award">
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <span className="badge-pop inline-flex h-20 w-20 items-center justify-center rounded-full text-ink" style={{ background: AWARD_TONE[badge.icon] }} aria-hidden>
              {(() => {
                const Icon = AWARD_ICON[badge.icon];
                return <Icon className="h-9 w-9" />;
              })()}
            </span>
            <p className="text-[18px] font-semibold text-ink">{badge.title}</p>
            <p className="text-[13px] text-ink-2">{badge.description}</p>
            {more > 0 ? <p className="text-[12px] text-ink-2">…and {more} more on Progress.</p> : null}
            <div className="mt-2 flex w-full gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShare({ kind: "award", awardId: badge.id, label: `"${badge.title}"` });
                  closeBadge();
                }}
              >
                Share
              </Button>
              <Button className="flex-1" onClick={closeBadge}>
                Nice
              </Button>
            </div>
          </div>
        </Sheet>
      ) : null}
      <ShareSheet what={share} onClose={() => setShare(null)} />
    </>
  );
}
