"use client";

import {
  adoptedPackIds,
  applySelection,
  STARTER_PACKS,
  tunableTarget,
  type PackChoice,
  type PackItem,
  type StarterPack,
} from "@life/shared";
import { ArrowLeft, Check } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, createElement, useState } from "react";
import { DisabledHint } from "@/components/auth/auth-shell";
import { Button, NumberStepper, StickyActions } from "@/components/kit";
import {
  ONBOARDED_KEY,
  TOUR_KEY,
} from "@/components/onboarding/onboarding-gate";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { useStore } from "@/components/providers/store-provider";
import { wholeNumber } from "@/lib/forms/validators";
import { toneInkClass } from "@/lib/theme/tokens";
import { categoryTone, iconFor } from "@/lib/v2/category-style";
import { scheduleSummary, trackingSummary } from "@/lib/v2/item-text";
import {
  useActions,
  useAllCategories,
  useNextCategoryOrder,
} from "@/lib/v2/use-day";

/** A ticked suggestion and its (possibly edited) target, keyed "packId:index". */
type Picks = Record<string, { target: string }>;

const keyOf = (pack: StarterPack, index: number) => `${pack.id}:${index}`;
const DAILY = { v: 1, kind: "daily" } as const;

function PackIcon({
  pack,
  size = "h-9 w-9",
}: {
  pack: StarterPack;
  size?: string;
}) {
  const tone = categoryTone(pack.category);
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded-[10px] ${toneInkClass(tone)}`}
      style={{ background: `var(--cat-${tone})` }}
      aria-hidden
    >
      {createElement(iconFor(pack.category.icon), { className: "h-4.5 w-4.5" })}
    </span>
  );
}

/** "Every day · 10,000 steps" for a suggestion (what it will look like on Today). */
function describe(spec: PackItem): string {
  if (spec.prayerSet)
    return "Fajr · Zuhr · Asr · Maghrib · Isha — times for your location";
  const parts = [scheduleSummary({ schedule: spec.schedule ?? DAILY })];
  if (spec.type === "group")
    parts.push(`${spec.children?.length ?? 0} sub-items`);
  else if (
    spec.tracking &&
    spec.tracking.kind !== "quantity" &&
    spec.tracking.kind !== "duration"
  ) {
    const t = trackingSummary({ tracking: spec.tracking });
    if (t) parts.push(t);
  }
  if (spec.isOptional) parts.push("optional");
  return parts.join(" · ");
}

/**
 * First-run setup (owner, 2026-10-11): 1) pick interests — they become your
 * categories; 2) tick the suggestions you want, nothing is pre-ticked, and
 * adjust their targets. With ?add=1 (from Categories) it adds interests not
 * set up yet.
 */
function Welcome() {
  const adding = useSearchParams().get("add") === "1";
  const categories = useAllCategories();
  const run = useActions();
  const nextOrder = useNextCategoryOrder();
  const { store } = useStore();
  const { notify } = useAddSheet();
  const router = useRouter();
  const [step, setStep] = useState<"interests" | "items">("interests");
  const [interests, setInterests] = useState<string[]>([]);
  const [picks, setPicks] = useState<Picks>({});

  const adopted = adoptedPackIds(categories);
  const packs = STARTER_PACKS.filter((p) => !adopted.has(p.id));
  const chosen = packs.filter((p) => interests.includes(p.id));
  const toggleInterest = (id: string) =>
    setInterests((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );
  const togglePick = (pack: StarterPack, index: number) =>
    setPicks((all) => {
      const key = keyOf(pack, index);
      if (all[key]) {
        const { [key]: _gone, ...rest } = all;
        return rest;
      }
      const t = tunableTarget(pack.items[index]);
      return { ...all, [key]: { target: t ? String(t.value) : "" } };
    });

  const errors = chosen.flatMap((pack) =>
    pack.items.flatMap((spec, index) => {
      const pick = picks[keyOf(pack, index)];
      const t = tunableTarget(spec);
      const msg =
        pick && t
          ? wholeNumber(`${spec.title} target`, 1, t.max)(pick.target)
          : null;
      return msg ? [msg] : [];
    }),
  );
  const pickedCount = Object.keys(picks).filter((k) =>
    chosen.some((p) => k.startsWith(`${p.id}:`)),
  ).length;

  function finish(choices: PackChoice[]) {
    if (choices.length)
      void run((ctx) =>
        applySelection(
          choices,
          categories,
          ctx,
          () => crypto.randomUUID(),
          nextOrder(),
        ),
      );
    if (!adding) {
      store?.setMeta(ONBOARDED_KEY, choices.length ? "packs" : "empty");
      store?.setMeta(TOUR_KEY, "pending");
      void store?.flush(); // the flags must survive an immediate reload
    }
    if (choices.length) {
      notify({
        message: `Added ${choices.length} categor${choices.length === 1 ? "y" : "ies"}${pickedCount ? ` and ${pickedCount} item${pickedCount === 1 ? "" : "s"}` : ""}`,
      });
    }
    router.replace(adding ? "/categories" : "/");
  }

  const submit = () =>
    finish(
      chosen.map((pack) => ({
        packId: pack.id,
        items: pack.items.flatMap((spec, index) => {
          const pick = picks[keyOf(pack, index)];
          if (!pick) return [];
          return [
            {
              index,
              ...(tunableTarget(spec) ? { target: Number(pick.target) } : {}),
            },
          ];
        }),
      })),
    );

  const back = (
    <button
      type="button"
      onClick={() =>
        step === "items" ? setStep("interests") : router.push("/categories")
      }
      className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />{" "}
      {step === "items" ? "Interests" : "Categories"}
    </button>
  );

  if (step === "items") {
    return (
      <div className="space-y-4">
        {back}
        <header>
          <p className="text-[12px] font-medium text-ink-2">Step 2 of 2</p>
          <h1 className="text-xl font-semibold text-ink">
            Pick what goes on your day
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-2">
            Only what you tick is added. You can add your own items any time
            with +.
          </p>
        </header>
        {chosen.map((pack) => (
          <section
            key={pack.id}
            aria-label={pack.name}
            className="card space-y-1 p-3"
          >
            <h2 className="mb-1 flex items-center gap-2 text-[14px] font-semibold text-ink">
              <PackIcon pack={pack} size="h-7 w-7" /> {pack.category.name}
            </h2>
            {pack.items.map((spec, index) => {
              const key = keyOf(pack, index);
              const pick = picks[key];
              const t = tunableTarget(spec);
              const err =
                pick && t ? wholeNumber("Target", 1, t.max)(pick.target) : null;
              return (
                <div key={key} className="rounded-xl px-1 py-1.5">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={Boolean(pick)}
                    onClick={() => togglePick(pack, index)}
                    className="flex w-full items-start gap-2.5 text-left"
                  >
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-2 ${pick ? "border-primary-strong bg-primary-strong text-on-primary-strong" : "border-ink-2"}`}
                    >
                      {pick ? (
                        <Check className="h-3 w-3" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] text-ink">
                        {spec.title}
                      </span>
                      <span className="block text-[12px] text-ink-2">
                        {describe(spec)}
                      </span>
                    </span>
                  </button>
                  {pick && t ? (
                    <div className="mt-1.5 ml-7.5">
                      <NumberStepper
                        label={`${spec.title} target`}
                        hideLabel
                        unit={t.unit}
                        step={tapStep(t)}
                        min={1}
                        max={t.max}
                        value={pick.target}
                        onChange={(v) =>
                          setPicks((all) => ({ ...all, [key]: { target: v } }))
                        }
                        error={err ? " " : null}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        ))}
        <StickyActions>
          <Button
            size="lg"
            className="w-full"
            disabled={errors.length > 0}
            onClick={submit}
          >
            {pickedCount
              ? `Finish — add ${pickedCount} item${pickedCount === 1 ? "" : "s"}`
              : "Finish — I'll add my own"}
          </Button>
          <DisabledHint show={errors.length > 0} message={errors[0] ?? ""} />
        </StickyActions>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {adding ? back : null}
      <header>
        <p className="text-[12px] font-medium text-ink-2">Step 1 of 2</p>
        <h1 className="text-xl font-semibold text-ink">
          {adding ? "Add interests" : "What matters to you?"}
        </h1>
        <p className="mt-0.5 text-[13px] text-ink-2">
          Each interest becomes a category. Next you&apos;ll choose what to
          track in it — nothing is added without your tick.
        </p>
      </header>

      {packs.length ? (
        <ul
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          aria-label="Interests"
        >
          {packs.map((p) => {
            const on = interests.includes(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleInterest(p.id)}
                  className={`card relative flex h-full w-full flex-col items-start gap-2 p-3 text-left transition-token ${on ? "ring-2 ring-primary-strong" : "hover:bg-track/40"}`}
                >
                  <PackIcon pack={p} />
                  <span className="block text-[14px] font-medium text-ink">
                    {p.name}
                  </span>
                  <span className="block text-[12px] leading-snug text-ink-2">
                    {p.description}
                  </span>
                  <span
                    aria-hidden
                    className={`absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full border-2 ${on ? "border-primary-strong bg-primary-strong text-on-primary-strong" : "border-border"}`}
                  >
                    {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="card px-4 py-6 text-center text-[13px] text-ink-2">
          You&apos;ve set up every interest.
        </p>
      )}

      <StickyActions>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            size="lg"
            className="sm:flex-1"
            disabled={!interests.length}
            onClick={() => setStep("items")}
          >
            {interests.length
              ? `Next — ${interests.length} interest${interests.length === 1 ? "" : "s"}`
              : "Pick at least one interest"}
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="sm:flex-1"
            onClick={() => (adding ? router.push("/categories") : finish([]))}
          >
            {adding ? "Cancel" : "Skip — start empty"}
          </Button>
        </div>
      </StickyActions>
    </div>
  );
}

/** What one − / + tap moves a target by: 500 steps, 5 minutes, 1 page or glass. */
function tapStep(t: { value: number; unit: string }): number {
  if (t.value >= 1000) return 500;
  if (/min/.test(t.unit)) return 5;
  if (t.value >= 50) return 10;
  return 1;
}

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <div className="skeleton h-40" aria-busy="true" aria-label="Loading" />
      }
    >
      <Welcome />
    </Suspense>
  );
}
