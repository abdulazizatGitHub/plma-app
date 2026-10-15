"use client";

import { AWARD_GROUPS, STATIC_AWARDS, awardDef, type AwardDef } from "@life/shared";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { AwardTile, awardHint } from "@/components/rewards/rewards-panel";
import { useRewards } from "@/lib/v2/use-rewards";

/**
 * Every award (Phase 8.1), grouped like the Health app's: earned ones in
 * colour with the date, locked ones with how far along. Seasonal awards
 * appear in their season and once earned; past challenges once met.
 */
export default function AwardsPage() {
  const router = useRouter();
  const { rewards } = useRewards();
  const earned = new Map((rewards?.badges ?? []).map((b) => [b.id, b.earnedAt]));
  const dynamic = new Set([...(rewards?.awards ?? []).map((a) => a.id), ...earned.keys()]);
  const defs: AwardDef[] = [...STATIC_AWARDS];
  for (const id of dynamic) {
    const d = awardDef(id);
    if (d && !defs.some((x) => x.id === id)) defs.push(d);
  }
  const count = defs.filter((d) => earned.has(d.id)).length;
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/progress"))}
        className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Progress
      </button>
      <header>
        <h1 className="text-2xl font-semibold text-ink">Awards</h1>
        <p className="text-[13px] text-ink-2">
          {rewards ? `${count} earned so far.` : "Awards appear after your first sync."} Each is earned once and kept for good.
        </p>
      </header>
      {AWARD_GROUPS.map((g) => {
        const list = defs.filter((d) => d.group === g.id);
        if (!list.length) return null;
        return (
          <section key={g.id} aria-label={g.title} className="card p-3">
            <h2 className="mb-1 px-1 text-[12px] font-semibold tracking-wide text-ink-2 uppercase">{g.title}</h2>
            <ul className="grid grid-cols-3 gap-1 sm:grid-cols-5">
              {list.map((def) => (
                <AwardTile key={def.id} def={def} earnedAt={earned.get(def.id)} hint={awardHint(rewards?.awards.find((a) => a.id === def.id), def)} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
