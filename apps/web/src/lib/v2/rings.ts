import { RING_LABEL, RING_ORDER, ringPct, type DayRings, type RewardDay, type RingKind, type RingState } from "@life/shared";
import type { StackRing } from "@/components/kit";

/** Ring colours: existing tokens only (owner: never invent colours). */
export const RING_COLOR: Record<RingKind, string> = { prayer: "var(--done)", commit: "var(--primary)", balance: "var(--progress)" };
export const RING_BG: Record<RingKind, string> = { prayer: "bg-done", commit: "bg-primary", balance: "bg-progress" };

const half = (n: number) => (Number.isInteger(n) ? String(n) : `${Math.floor(n) || ""}½`);

/** "4½/5", "Free" … */
export function ringCount(r: RingState | null): string {
  return r ? `${half(r.fill)}/${r.due}` : "Free";
}

export function ringNoun(kind: RingKind, r: RingState | null): string {
  if (!r) return "nothing due";
  return kind === "prayer" ? "prayed" : kind === "commit" ? "done" : r.due === 1 ? "area" : "areas";
}

export function stackFromRings(rings: Pick<DayRings, RingKind>): StackRing[] {
  return RING_ORDER.map((k) => ({ key: k, pct: rings[k] ? ringPct(rings[k]) : null, color: RING_COLOR[k], closed: !!rings[k]?.closed }));
}

/** A stored day (server) as rings, for the week strip. */
export function stackFromDay(d: RewardDay | undefined): StackRing[] {
  const pct = (fill: number, due: number) => (due ? Math.min(100, Math.round((fill / due) * 100)) : null);
  return [
    { key: "prayer", pct: d ? pct(d.prayerFill / 2, d.prayerDue) : null, color: RING_COLOR.prayer, closed: !!d?.prayerClosed },
    { key: "commit", pct: d ? pct(d.commitDone, d.commitDue) : null, color: RING_COLOR.commit, closed: !!d?.commitClosed },
    { key: "balance", pct: d ? pct(d.balanceDone, d.balanceDue) : null, color: RING_COLOR.balance, closed: !!d?.balanceClosed },
  ];
}

/** "Prayer 4 of 5 · Commitments 1 of 2 · Balance free" for screen readers. */
export function ringsLabel(rings: Pick<DayRings, RingKind>): string {
  return RING_ORDER.map((k) => {
    const r = rings[k];
    return r ? `${RING_LABEL[k]} ${half(r.fill)} of ${r.due}${r.closed ? " (closed)" : ""}` : `${RING_LABEL[k]} free`;
  }).join(" · ");
}
