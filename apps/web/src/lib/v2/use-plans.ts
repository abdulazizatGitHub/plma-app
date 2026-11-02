"use client";

import { lockOf, planProgress, type CadenceRule, type Item, type ItemDependency, type Occurrence } from "@life/shared";
import { useCallback, useMemo } from "react";
import { useStore } from "@/components/providers/store-provider";
import { useStoreVersion } from "./use-day";

export type PlansData = {
  plans: Item[];
  /** Every live step of every plan. */
  steps: Item[];
  deps: ItemDependency[];
  rules: CadenceRule[];
  /** Occurrences of plan steps (to know what's done). */
  occs: Occurrence[];
  ready: boolean;
};

const EMPTY: PlansData = { plans: [], steps: [], deps: [], rules: [], occs: [], ready: false };

/** All plans with their steps, "waits for" links, cadence rules and step occurrences (PLN-01…06). */
export function usePlansData(): PlansData {
  const { store } = useStore();
  const version = useStoreVersion(store);
  return useMemo(() => {
    if (!store) return EMPTY;
    const plans = store.query("items", `WHERE "type" = 'plan' AND "deleted_at" IS NULL ORDER BY "sort_order", "created_at"`) as unknown as Item[];
    const planIds = plans.map((p) => p.id);
    const marks = planIds.map(() => "?").join(",");
    const steps = planIds.length
      ? (store.query("items", `WHERE "parent_id" IN (${marks}) AND "deleted_at" IS NULL ORDER BY "sort_order"`, planIds) as unknown as Item[])
      : [];
    const stepIds = steps.map((s) => s.id);
    const occs = stepIds.length
      ? (store.query("occurrences", `WHERE "item_id" IN (${stepIds.map(() => "?").join(",")}) AND "deleted_at" IS NULL`, stepIds) as unknown as Occurrence[])
      : [];
    const deps = store.query("itemDependencies", `WHERE "deleted_at" IS NULL`) as unknown as ItemDependency[];
    const rules = store.query("cadenceRules", `WHERE "deleted_at" IS NULL`) as unknown as CadenceRule[];
    return { plans, steps, deps, rules, occs, ready: true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version]);
}

/** For a plan step on Today: what it waits for (only queried for plan steps). */
export function useStepLock(step: Item | null, isPlanStep: boolean): { locked: boolean; waitingFor: Item[] } {
  const { store } = useStore();
  const version = useStoreVersion(store);
  return useMemo(() => {
    if (!store || !step || !isPlanStep) return { locked: false, waitingFor: [] };
    const deps = store.query("itemDependencies", `WHERE "item_id" = ? AND "deleted_at" IS NULL`, [step.id]) as unknown as ItemDependency[];
    if (!deps.length) return { locked: false, waitingFor: [] };
    const ids = deps.map((d) => d.dependsOnId);
    const marks = ids.map(() => "?").join(",");
    const others = store.query("items", `WHERE "id" IN (${marks}) AND "deleted_at" IS NULL`, ids) as unknown as Item[];
    const occs = store.query("occurrences", `WHERE "item_id" IN (${marks}) AND "deleted_at" IS NULL`, ids) as unknown as Occurrence[];
    return lockOf(step, deps, others, occs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version, step, isPlanStep]);
}

/** Whether every step of a plan is done right now (read straight from the store, e.g. after a tick). */
export function usePlanIsComplete() {
  const { store } = useStore();
  return useCallback(
    (planId: string, today: string) => {
      if (!store) return false;
      const steps = store.query("items", `WHERE "parent_id" = ? AND "deleted_at" IS NULL`, [planId]) as unknown as Item[];
      if (!steps.length) return false;
      const ids = steps.map((s) => s.id);
      const occs = store.query("occurrences", `WHERE "item_id" IN (${ids.map(() => "?").join(",")}) AND "deleted_at" IS NULL`, ids) as unknown as Occurrence[];
      return planProgress({ id: planId }, steps, occs, today).complete;
    },
    [store],
  );
}
