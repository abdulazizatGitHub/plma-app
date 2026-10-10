"use client";

import {
  buildDay,
  dayProgress,
  pendingItems,
  type ActionContext,
  type Category,
  type Change,
  type DayEntry,
  type DayProgress,
  type Item,
  type Occurrence,
} from "@life/shared";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useStore } from "@/components/providers/store-provider";
import type { LocalStore } from "./local-store";

const noop = () => () => undefined;

/** Re-renders when the store changes. */
function useStoreVersion(store: LocalStore | null) {
  return useSyncExternalStore(
    store ? store.subscribe : noop,
    () => store?.version ?? -1,
    () => -1,
  );
}

function readItems(store: LocalStore): Item[] {
  return store.query("items", `WHERE "deleted_at" IS NULL`) as unknown as Item[];
}

function readOccurrences(store: LocalStore, date: string): Occurrence[] {
  return store.query("occurrences", `WHERE "date" = ? AND "deleted_at" IS NULL`, [date]) as unknown as Occurrence[];
}

/** Saves an action's rows locally (instant UI) and schedules a sync. */
export function useActions() {
  const { store, syncSoon } = useStore();
  const { user } = useAuth();
  return useCallback(
    async (build: (ctx: ActionContext) => Change[] | Promise<Change[]>) => {
      if (!store || !user) return;
      const ctx: ActionContext = { userId: user.id, now: new Date().toISOString(), deviceId: store.deviceId() };
      const changes = await build(ctx);
      for (const c of changes) store.save(c.entity, c.row as unknown as Parameters<LocalStore["save"]>[1]);
      syncSoon();
    },
    [store, user, syncSoon],
  );
}

export type DayView = { entries: DayEntry[]; progress: DayProgress; ready: boolean };

/** One day's entries and progress (SYSTEM_DESIGN §5.1). */
export function useDay(date: string): DayView {
  const { store } = useStore();
  const version = useStoreVersion(store);
  return useMemo(() => {
    if (!store) return { entries: [], progress: dayProgress([]), ready: false };
    const entries = buildDay(readItems(store), readOccurrences(store, date), date);
    return { entries, progress: dayProgress(entries), ready: true };
    // `version` is the change signal for the mutable store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version, date]);
}

/** Several days at once (date-strip dots, 7-day bars). */
export function useDays(dates: string[]): Map<string, DayView> {
  const { store } = useStore();
  const version = useStoreVersion(store);
  const key = dates.join(",");
  return useMemo(() => {
    const out = new Map<string, DayView>();
    if (!store) return out;
    const items = readItems(store);
    for (const date of dates) {
      const entries = buildDay(items, readOccurrences(store, date), date);
      out.set(date, { entries, progress: dayProgress(entries), ready: true });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version, key]);
}

export type DayGroup = { date: string; entries: DayEntry[] };

/**
 * One-off tasks (and instances moved in) on the next `days` days, grouped by
 * day. Repeating habits are left out so the list stays about plans, not routine.
 */
export function useUpcoming(today: string | null, days = 14): DayGroup[] {
  const { store } = useStore();
  const version = useStoreVersion(store);
  return useMemo(() => {
    if (!store || !today) return [];
    const items = readItems(store);
    const out: DayGroup[] = [];
    for (let i = 1; i <= days; i++) {
      const date = addDaysIso(today, i);
      const entries = buildDay(items, readOccurrences(store, date), date).filter(
        (e) => !e.children && (e.item.schedule.kind === "once" || e.slot !== ""),
      );
      if (entries.length) out.push({ date, entries });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version, today, days]);
}

/** One-off tasks from earlier days that were never done or skipped. */
export function useOverdue(today: string | null): DayEntry[] {
  const { store } = useStore();
  const version = useStoreVersion(store);
  return useMemo(() => {
    if (!store || !today) return [];
    const out: DayEntry[] = [];
    for (const item of readItems(store)) {
      const s = item.schedule;
      if (item.parentId || item.archivedAt || s.kind !== "once" || !s.date || s.date >= today) continue;
      const [entry] = buildDay([item], readOccurrences(store, s.date), s.date);
      const status = entry?.occurrence?.status;
      if (entry && status !== "done" && status !== "skipped" && status !== "moved") out.push(entry);
    }
    return out.sort((a, b) => scheduleDate(a).localeCompare(scheduleDate(b)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version, today]);
}

const scheduleDate = (e: DayEntry) => (e.item.schedule.kind === "once" ? (e.item.schedule.date ?? "") : "");

function addDaysIso(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + n, 12);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function usePending(): Item[] {
  const { store } = useStore();
  const version = useStoreVersion(store);
  return useMemo(
    () => (store ? pendingItems(readItems(store)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, version],
  );
}

export function useCategories(): Category[] {
  const { store } = useStore();
  const version = useStoreVersion(store);
  return useMemo(
    () =>
      store
        ? (store.query("categories", `WHERE "deleted_at" IS NULL AND "archived_at" IS NULL ORDER BY "sort_order"`) as unknown as Category[])
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, version],
  );
}

/** Next sort order for new items. */
export function useNextSortOrder() {
  const { store } = useStore();
  return useCallback(() => {
    if (!store) return 0;
    const items = readItems(store);
    return items.reduce((max, i) => Math.max(max, i.sortOrder), 0) + 1;
  }, [store]);
}

/** Every live category, archived ones included (Categories → Archived). */
export function useAllCategories(): Category[] {
  const { store } = useStore();
  const version = useStoreVersion(store);
  return useMemo(
    () => (store ? (store.query("categories", `WHERE "deleted_at" IS NULL ORDER BY "sort_order"`) as unknown as Category[]) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, version],
  );
}

export function useCategory(id: string | null): Category | null {
  const all = useAllCategories();
  return useMemo(() => all.find((c) => c.id === id) ?? null, [all, id]);
}

/** Every live item, archived ones included; `ready` is false until the store opens. */
export function useAllItems(): { items: Item[]; ready: boolean } {
  const { store } = useStore();
  const version = useStoreVersion(store);
  return useMemo(
    () => ({ items: store ? readItems(store) : [], ready: Boolean(store) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, version],
  );
}

export function useItem(id: string | null): { item: Item | null; children: Item[]; ready: boolean } {
  const { items, ready } = useAllItems();
  return useMemo(() => {
    const item = items.find((i) => i.id === id) ?? null;
    const children = item ? items.filter((i) => i.parentId === item.id).sort((a, b) => a.sortOrder - b.sortOrder) : [];
    return { item, children, ready };
  }, [items, id, ready]);
}

/** Occurrences of an item (and its sub-items) between two dates, for history. */
export function useItemOccurrences(itemIds: string[], from: string, to: string): Occurrence[] {
  const { store } = useStore();
  const version = useStoreVersion(store);
  const key = itemIds.join(",");
  return useMemo(() => {
    if (!store || !itemIds.length) return [];
    const marks = itemIds.map(() => "?").join(",");
    return store.query(
      "occurrences",
      `WHERE "item_id" IN (${marks}) AND "date" >= ? AND "date" <= ? AND "deleted_at" IS NULL`,
      [...itemIds, from, to],
    ) as unknown as Occurrence[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version, key, from, to]);
}

/** Next sort order for a new category (end of the list). */
export function useNextCategoryOrder() {
  const { store } = useStore();
  return useCallback(() => {
    if (!store) return 0;
    const all = store.query("categories", `WHERE "deleted_at" IS NULL`) as unknown as Category[];
    return all.reduce((max, c) => Math.max(max, c.sortOrder + 1), 0);
  }, [store]);
}
