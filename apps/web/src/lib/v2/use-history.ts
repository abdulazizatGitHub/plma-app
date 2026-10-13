"use client";

import {
  itemHistory,
  periodMonth,
  periodSummary,
  periodWeek,
  previousPeriod,
  type Item,
  type ItemHistory,
  type Occurrence,
  type PeriodSummary,
} from "@life/shared";
import { useMemo } from "react";
import { useStore } from "@/components/providers/store-provider";
import { useAllCategories, useAllItems, useClosedThrough, useStoreVersion, useUserSettings } from "./use-day";

export type PeriodKind = "week" | "month";

/** Occurrences of every item in [from, to]. */
function useRangeOccurrences(from: string, to: string): Occurrence[] {
  const { store } = useStore();
  const version = useStoreVersion(store);
  return useMemo(
    () => (store ? (store.query("occurrences", `WHERE "date" >= ? AND "date" <= ? AND "deleted_at" IS NULL`, [from, to]) as unknown as Occurrence[]) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, from, to, version],
  );
}

/**
 * This week / month (holding `anchor`) and the one before it, for Progress
 * (HIS-02/03). Closed days are read from stored rows only.
 */
export function usePeriodSummary(kind: PeriodKind, anchor: string, today: string): { current: PeriodSummary; previous: PeriodSummary } {
  const settings = useUserSettings();
  const range = kind === "week" ? periodWeek(anchor, settings.weekStart) : periodMonth(anchor);
  const prev = previousPeriod(range, kind);
  const { items } = useAllItems();
  const categories = useAllCategories();
  const occurrences = useRangeOccurrences(prev.from, range.to);
  const closedThrough = useClosedThrough();
  return useMemo(() => {
    const input = { items, occurrences, categories };
    return {
      current: periodSummary(input, { ...range, today, closedThrough }),
      previous: periodSummary(input, { ...prev, today, closedThrough }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, occurrences, categories, range.from, range.to, prev.from, prev.to, today, closedThrough]);
}

/** One item's history over [from, to], with its log (HIS-01). */
export function useItemHistory(item: Item | null, children: Item[], from: string, to: string, today: string): ItemHistory | null {
  const ids = useMemo(() => (item ? [item.id, ...children.map((c) => c.id)] : []), [item, children]);
  const all = useRangeOccurrences(from, to);
  const closedThrough = useClosedThrough();
  return useMemo(() => {
    if (!item) return null;
    const mine = all.filter((o) => ids.includes(o.itemId));
    return itemHistory(item, children, mine, from, to, today, closedThrough);
  }, [item, children, all, ids, from, to, today, closedThrough]);
}

/** Any range (e.g. the last 7 finished days). */
export function useRangeSummary(from: string, to: string, today: string): PeriodSummary {
  const { items } = useAllItems();
  const categories = useAllCategories();
  const occurrences = useRangeOccurrences(from, to);
  const closedThrough = useClosedThrough();
  return useMemo(() => periodSummary({ items, occurrences, categories }, { from, to, today, closedThrough }), [items, occurrences, categories, from, to, today, closedThrough]);
}
