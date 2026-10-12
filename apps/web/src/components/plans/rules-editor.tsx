"use client";

import { STEP_KINDS, deleteCadenceRule, saveCadenceRule, type CadenceRule, type Change, type Item, type StepKind } from "@life/shared";
import { useState } from "react";
import { ChipChoice, SegmentedTabs } from "@/components/kit";
import { useStore } from "@/components/providers/store-provider";
import { useActions } from "@/lib/v2/use-day";

const WEEK = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
] as const;
const GAPS = [0, 1, 2, 3, 7];

type Scope = "plan" | "category";

/** One queue for rule edits, so quick taps build on each other instead of on a stale list. */
let ruleQueue: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>) {
  ruleQueue = ruleQueue.then(task).catch(() => undefined);
}

/**
 * Cadence rules (PLN-04) for the kinds of step in this plan: which weekdays
 * suit them and the minimum gap between steps of the same kind. Scope: this
 * plan, or every plan in its category (e.g. "posts at least 2 days apart").
 */
export function RulesEditor({ plan, kinds, rules, categoryName }: { plan: Item; kinds: StepKind[]; rules: CadenceRule[]; categoryName: string | null }) {
  const run = useActions();
  const { store } = useStore();
  const [scope, setScope] = useState<Scope>("plan");
  /** Runs an edit against the rules as stored right now (after earlier queued edits). */
  const edit = (build: (current: CadenceRule[], ctx: Parameters<Parameters<typeof run>[0]>[0]) => Change[]) => {
    enqueue(() => run((ctx) => build(store ? (store.query("cadenceRules", `WHERE "deleted_at" IS NULL`) as unknown as CadenceRule[]) : rules, ctx)));
  };
  const inScope = (r: CadenceRule) =>
    !r.deletedAt && (scope === "plan" ? r.planItemId === plan.id : r.planItemId === null && r.categoryId === plan.categoryId);
  const scopeRef = scope === "plan" ? { planItemId: plan.id } : { categoryId: plan.categoryId as string };
  const findIn = (list: CadenceRule[], kind: StepKind, type: CadenceRule["rule"]["type"]) => list.find((r) => inScope(r) && r.stepKind === kind && r.rule.type === type);
  const find = (kind: StepKind, type: CadenceRule["rule"]["type"]) => findIn(rules, kind, type);
  const newId = () => crypto.randomUUID();

  /** Toggle one weekday on the stored rule (no days left → no rule). */
  const toggleDay = (kind: StepKind, day: number) =>
    edit((current, ctx) => {
      const existing = findIn(current, kind, "weekdays");
      const days = existing?.rule.type === "weekdays" ? existing.rule.days : [];
      const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
      if (!next.length) return existing ? deleteCadenceRule(existing, ctx) : [];
      return saveCadenceRule({ scope: scopeRef, stepKind: kind, rule: { type: "weekdays", days: next.sort() } }, current, ctx, newId);
    });
  const setGap = (kind: StepKind, n: number) =>
    edit((current, ctx) => {
      const existing = findIn(current, kind, "gapDays");
      if (!n) return existing ? deleteCadenceRule(existing, ctx) : [];
      return saveCadenceRule({ scope: scopeRef, stepKind: kind, rule: { type: "gapDays", n } }, current, ctx, newId);
    });

  return (
    <section aria-label="Rules" className="card space-y-3 p-3.5">
      <div>
        <h2 className="text-[14px] font-semibold text-ink">Rules</h2>
        <p className="text-[12px] text-ink-2">Dates that break a rule get a warning and a suggestion. You can always keep your date.</p>
      </div>
      {plan.categoryId ? (
        <SegmentedTabs<Scope>
          label="Rules apply to"
          value={scope}
          onChange={setScope}
          options={[
            { value: "plan", label: "This plan" },
            { value: "category", label: `All ${categoryName ?? "category"} plans` },
          ]}
        />
      ) : null}
      {kinds.length ? (
        <ul className="space-y-3">
          {kinds.map((kind) => {
            const days = find(kind, "weekdays")?.rule;
            const picked = days?.type === "weekdays" ? days.days : [];
            const gap = find(kind, "gapDays")?.rule;
            return (
              <li key={kind} aria-label={`${STEP_KINDS[kind].label} rules`} className="space-y-1.5">
                <p className="text-[13px] font-medium text-ink">{STEP_KINDS[kind].label}</p>
                <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`${STEP_KINDS[kind].label} days`}>
                  {WEEK.map(([d, label]) => {
                    const on = picked.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleDay(kind, d)}
                        className={`h-8 min-w-10 rounded-full px-2 text-[12px] font-medium ${on ? "bg-primary text-on-fill" : "bg-track text-ink hover:bg-border"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                  <span className="text-[11.5px] text-ink-2">{picked.length ? "" : "Any day"}</span>
                </div>
                <ChipChoice
                  legend={`Keep ${STEP_KINDS[kind].label.toLowerCase()} steps apart by`}
                  options={(gap?.type === "gapDays" && !GAPS.includes(gap.n) ? [...GAPS, gap.n].sort((a, b) => a - b) : GAPS).map((g) => ({
                    value: g,
                    label: g ? `${g} day${g === 1 ? "" : "s"}+` : "Any gap",
                  }))}
                  value={gap?.type === "gapDays" ? gap.n : 0}
                  onChange={(g) => setGap(kind, g)}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[12px] text-ink-2">Add dated steps to set rules for them.</p>
      )}
    </section>
  );
}
