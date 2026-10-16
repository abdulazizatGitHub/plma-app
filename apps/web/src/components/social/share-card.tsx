"use client";

import { awardDef, shareText, type AwardIcon, type SharePayload } from "@life/shared";
import { Flame, Moon } from "lucide-react";
import { RingStack } from "@/components/kit";
import { AWARD_ICON, AWARD_TONE } from "@/components/rewards/rewards-panel";
import { RING_COLOR } from "@/lib/v2/rings";

/** The picture part of a share: rings for a day, a flame for a streak, the award's medal. */
export function ShareVisual({ payload, size = 48 }: { payload: SharePayload; size?: number }) {
  if (payload.kind === "day") {
    const pct = (r: [number, number] | null) => (r ? Math.min(100, Math.round((r[0] / r[1]) * 100)) : null);
    return (
      <RingStack
        label=""
        size={size}
        stroke={Math.max(4, Math.round(size / 9))}
        gap={1.5}
        rings={[
          { key: "prayer", pct: pct(payload.rings.prayer), color: RING_COLOR.prayer },
          { key: "commit", pct: pct(payload.rings.commit), color: RING_COLOR.commit },
          { key: "balance", pct: pct(payload.rings.balance), color: RING_COLOR.balance },
        ]}
      />
    );
  }
  if (payload.kind === "award") {
    const icon = (awardDef(payload.awardId)?.icon ?? payload.icon) as AwardIcon;
    const Icon = AWARD_ICON[icon] ?? AWARD_ICON.medal;
    return (
      <span className="inline-flex shrink-0 items-center justify-center rounded-full text-ink" style={{ width: size, height: size, background: AWARD_TONE[icon] ?? AWARD_TONE.medal }} aria-hidden>
        <Icon className="h-1/2 w-1/2" />
      </span>
    );
  }
  const Icon = payload.kind === "item_streak" && payload.prayer ? Moon : Flame;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center rounded-full text-ink" style={{ width: size, height: size, background: payload.kind === "item_streak" && payload.prayer ? "var(--cat-lilac)" : "var(--cat-peach)" }} aria-hidden>
      <Icon className="h-[45%] w-[45%]" />
      <span className="absolute -right-1 -bottom-1 min-w-5 rounded-full bg-surface px-1 text-center text-[11px] font-semibold text-ink shadow-sm">{payload.current}</span>
    </span>
  );
}

/** "21-day Fajr streak · best 30" etc. */
export function shareDetail(p: SharePayload): string | null {
  if (p.kind === "streak" || p.kind === "item_streak") return p.best > p.current ? `Best ${p.best}` : "Their best yet";
  if (p.kind === "day") return p.perfect ? "Perfect day" : p.complete ? "Day complete" : null;
  if (p.kind === "award") return awardDef(p.awardId)?.description ?? null;
  return null;
}

export { shareText };
