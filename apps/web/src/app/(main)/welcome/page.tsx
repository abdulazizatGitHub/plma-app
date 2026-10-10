"use client";

import { adoptedPackIds, applyPacks, STARTER_PACKS } from "@life/shared";
import { ArrowLeft, Check } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, createElement, useState } from "react";
import { Button } from "@/components/kit";
import { ONBOARDED_KEY } from "@/components/onboarding/onboarding-gate";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { useStore } from "@/components/providers/store-provider";
import { toneInkClass } from "@/lib/theme/tokens";
import { categoryTone, iconFor } from "@/lib/v2/category-style";
import { useActions, useAllCategories, useNextCategoryOrder } from "@/lib/v2/use-day";

/**
 * Starter packs (CAT-05): new accounts pick what they want to track, or start
 * empty. With ?add=1 (from Categories) it adds packs not adopted yet.
 */
function Welcome() {
  const adding = useSearchParams().get("add") === "1";
  const categories = useAllCategories();
  const run = useActions();
  const nextOrder = useNextCategoryOrder();
  const { store } = useStore();
  const { notify } = useAddSheet();
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);

  const adopted = adoptedPackIds(categories);
  const packs = STARTER_PACKS.filter((p) => !adopted.has(p.id));
  const toggle = (id: string) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  function finish(ids: string[]) {
    if (ids.length) void run((ctx) => applyPacks(ids, categories, ctx, () => crypto.randomUUID(), nextOrder()));
    store?.setMeta(ONBOARDED_KEY, ids.length ? "packs" : "empty");
    if (ids.length) notify({ message: `Added ${ids.length} pack${ids.length === 1 ? "" : "s"}` });
    router.replace(adding ? "/categories" : "/");
  }

  return (
    <div className="space-y-4">
      {adding ? (
        <button type="button" onClick={() => router.push("/categories")} className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Categories
        </button>
      ) : null}
      <header>
        <h1 className="text-xl font-semibold text-ink">{adding ? "Add starter packs" : "What do you want to track?"}</h1>
        <p className="mt-0.5 text-[13px] text-ink-2">
          {adding ? "Each pack adds a category with ready-made items." : "Pick a few starter packs — you can edit, archive or delete anything later."}
        </p>
      </header>

      {packs.length ? (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Starter packs">
          {packs.map((p) => {
            const on = picked.includes(p.id);
            const tone = categoryTone(p.category);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(p.id)}
                  className={`card flex h-full w-full items-start gap-3 p-3 text-left transition-token ${on ? "ring-2 ring-primary-strong" : "hover:bg-track/40"}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${toneInkClass(tone)}`} style={{ background: `var(--cat-${tone})` }} aria-hidden>
                    {createElement(iconFor(p.category.icon), { className: "h-4.5 w-4.5" })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium text-ink">{p.name}</span>
                    <span className="block text-[12px] text-ink-2">{p.description}</span>
                    <span className="mt-1 block text-[11.5px] text-ink-2">{p.items.map((i) => i.title).join(" · ")}</span>
                  </span>
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-primary-strong bg-primary-strong text-on-primary-strong" : "border-border"}`}
                  >
                    {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="card px-4 py-6 text-center text-[13px] text-ink-2">You&apos;ve added every starter pack.</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button size="lg" className="sm:flex-1" disabled={!picked.length} onClick={() => finish(picked)}>
          {picked.length ? `${adding ? "Add" : "Start with"} ${picked.length} pack${picked.length === 1 ? "" : "s"}` : "Pick at least one pack"}
        </Button>
        <Button size="lg" variant="secondary" className="sm:flex-1" onClick={() => (adding ? router.push("/categories") : finish([]))}>
          {adding ? "Cancel" : "Start empty"}
        </Button>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<div className="skeleton h-40" aria-busy="true" aria-label="Loading" />}>
      <Welcome />
    </Suspense>
  );
}
