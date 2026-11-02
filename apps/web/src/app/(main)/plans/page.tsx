"use client";

import { PLAN_PRESETS, planProgress } from "@life/shared";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/kit";
import { NewPlanSheet } from "@/components/plans/new-plan-sheet";
import { PlanCard } from "@/components/plans/plan-card";
import { usePlansData } from "@/lib/v2/use-plans";
import { useToday } from "@/lib/v2/use-today";

/** Plans (PLN-01…06): collabs, courses and other multi-step work with dates. */
function Plans() {
  const { plans, steps, occs, ready } = usePlansData();
  const askNew = useSearchParams().get("new") === "1";
  const [creating, setCreating] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const today = useToday();
  useEffect(() => {
    if (askNew) setCreating(true); // eslint-disable-line react-hooks/set-state-in-effect -- open the sheet when arriving with ?new=1
  }, [askNew]);

  if (!ready || !today) return <div className="skeleton h-40" aria-busy="true" aria-label="Loading plans" />;
  const live = plans.filter((p) => !p.archivedAt);
  const done = live.filter((p) => planProgress(p, steps, occs, today).complete);
  const active = live.filter((p) => !done.includes(p));

  return (
    <div className="space-y-4">
      <Link href="/categories" className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Categories
      </Link>
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-ink">Plans</h1>
          <p className="text-[12px] text-ink-2">Collabs, courses and other work with several dated steps.</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> New plan
        </Button>
      </header>

      {active.length ? (
        <section aria-label="Active plans" className="space-y-2">
          {active.map((p) => (
            <PlanCard key={p.id} plan={p} steps={steps} occs={occs} today={today} />
          ))}
        </section>
      ) : (
        <div className="card space-y-2 px-5 py-6 text-center">
          <p className="text-[14px] font-medium text-ink">No active plans.</p>
          <p className="text-[12px] text-ink-2">
            {PLAN_PRESETS.collab.label}: {PLAN_PRESETS.collab.description}
            <br />
            {PLAN_PRESETS.university.label}: {PLAN_PRESETS.university.description}
          </p>
          <Button className="mt-1" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New plan
          </Button>
        </div>
      )}

      {done.length ? (
        <section aria-label="Completed plans">
          <button type="button" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)} className="min-h-9 text-[13px] font-medium text-ink-2 hover:text-ink">
            Completed · {done.length}
          </button>
          {showDone ? (
            <div className="mt-1 space-y-2">
              {done.map((p) => (
                <PlanCard key={p.id} plan={p} steps={steps} occs={occs} today={today} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <NewPlanSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

export default function PlansPage() {
  return (
    <Suspense fallback={<div className="skeleton h-40" aria-busy="true" aria-label="Loading plans" />}>
      <Plans />
    </Suspense>
  );
}
