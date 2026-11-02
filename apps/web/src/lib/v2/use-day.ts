"use client";

import {
  buildDay,
  customReminders,
  isLateLog,
  dayProgress,
  defaultUserSettings,
  pendingItems,
  dayStreak,
  prayerTimes,
  toLocalDateString,
  updateSettings,
  type DayStreak,
  type DayPrayerTimes,
  type UserSettings,
  type ActionContext,
  type Category,
  type Change,
  type DayEntry,
  type DayProgress,
  type Item,
  type Occurrence,
  type Reminder,
} from "@life/shared";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useStore } from "@/components/providers/store-provider";
import type { LocalStore } from "./local-store";
import { useToday } from "./use-today";

const noop = () => () => undefined;

/** Re-renders when the store changes. */
export function useStoreVersion(store: LocalStore | null) {
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
  // Changes past an item's on-time point are stamped late (Phase 7); the server confirms.
  const today = useToday();
  const settings = useUserSettings();
  return useCallback(
    async (build: (ctx: ActionContext) => Change[] | Promise<Change[]>) => {
      if (!store || !user) return;
      const now = new Date();
      const ctx: ActionContext = {
        userId: user.id,
        now: now.toISOString(),
        deviceId: store.deviceId(),
        today: today ?? undefined,
        isLate: (item, date) => isLateLog(item, date, now, settings),
      };
      const changes = await build(ctx);
      for (const c of changes) store.save(c.entity, c.row as unknown as Parameters<LocalStore["save"]>[1]);
      syncSoon();
      // Persist now, not on the 250 ms timer: a save followed by a full page
      // load (reload, or "Back" into another document) would otherwise lose it.
      await store.flush();
    },
    [store, user, syncSoon, today, settings],
  );
}

/** Days up to here are closed on the server (final; history reads stored rows only). */
export function useClosedThrough(): string | null {
  const { store } = useStore();
  const version = useStoreVersion(store);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (store ? store.getMeta("closed_through") || null : null), [store, version]);
}

/** Has this device finished a sync yet? null while the store opens. */
export function useHasSynced(): boolean | null {
  const { store } = useStore();
  const version = useStoreVersion(store);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (store ? !!store.getMeta("last_synced_at") : null), [store, version]);
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
    const all = readItems(store);
    const plans = new Map(all.filter((i) => i.type === "plan" && !i.archivedAt).map((i) => [i.id, i]));
    for (const item of all) {
      const s = item.schedule;
      // Plan steps can be overdue too; other children belong to their parent.
      const plan = item.parentId ? plans.get(item.parentId) : undefined;
      if ((item.parentId && !plan) || item.type === "plan" || item.archivedAt || s.kind !== "once" || !s.date || s.date >= today) continue;
      const [entry] = buildDay(plan ? [plan, item] : [item], readOccurrences(store, s.date), s.date);
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
  return useMemo(() => {
    if (!store) return [];
    // An undated plan step ticked on its plan (e.g. "Payment cleared") is done, not pending.
    const done = new Set(
      (store.query("occurrences", `WHERE "status" = 'done' AND "deleted_at" IS NULL`) as unknown as Occurrence[]).map((o) => o.itemId),
    );
    return pendingItems(readItems(store))
      .filter((i) => !done.has(i.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version]);
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

/** The synced settings row with defaults filled in (the device's zone until the first pull). */
function readUserSettings(store: LocalStore | null, userId: string | undefined): UserSettings {
  const fallback = defaultUserSettings(userId ?? "00000000-0000-4000-8000-000000000000", new Date(0).toISOString(), Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Karachi");
  const row = store && userId ? (store.query("userSettings", `WHERE "user_id" = ? AND "deleted_at" IS NULL LIMIT 1`, [userId])[0] as Partial<UserSettings> | undefined) : undefined;
  if (!row) return fallback;
  const filled = { ...fallback } as Record<string, unknown>;
  for (const [k, v] of Object.entries(row)) if (v !== null && v !== undefined) filled[k] = v;
  for (const k of ["lat", "lng", "locationLabel", "quietFrom", "quietTo", "planTomorrowAt", "morningSummaryAt"] as const) filled[k] = row[k] ?? null;
  return filled as UserSettings;
}

export function useUserSettings(): UserSettings {
  const { store } = useStore();
  const { user } = useAuth();
  const version = useStoreVersion(store);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => readUserSettings(store, user?.id), [store, user, version]);
}

type SettingsPatch = Parameters<typeof updateSettings>[1];
/** One queue for every settings write in the tab, so quick edits never overwrite each other. */
let settingsQueue: Promise<void> = Promise.resolve();

/**
 * Saves settings edits in order, each applied to the latest stored row. Pass
 * a function to build the patch from the current settings (e.g. +1 minute).
 */
export function useSaveSettings() {
  const { store } = useStore();
  const { user } = useAuth();
  const run = useActions();
  return useCallback(
    (patch: SettingsPatch | ((current: UserSettings) => SettingsPatch)) => {
      settingsQueue = settingsQueue
        .then(() =>
          run((ctx) => {
            const current = readUserSettings(store, user?.id);
            return updateSettings(current, typeof patch === "function" ? patch(current) : patch, ctx);
          }),
        )
        .catch(() => undefined);
      return settingsQueue;
    },
    [store, user, run],
  );
}

/** Prayer times for a day from the user's settings (offline; Karachi until a location is set). */
export function usePrayerTimes(date: string | null): DayPrayerTimes | null {
  const settings = useUserSettings();
  return useMemo(() => (date ? prayerTimes(date, settings) : null), [date, settings]);
}

/** The prayer block (Daily prayers) and its prayers, if the user has one. */
export function usePrayerSet(): { group: Item | null; prayers: Item[] } {
  const { items } = useAllItems();
  return useMemo(() => {
    const group = items.find((i) => i.meta.prayerSet === true && !i.archivedAt) ?? null;
    const prayers = group ? items.filter((i) => i.parentId === group.id && !i.archivedAt).sort((a, b) => a.sortOrder - b.sortOrder) : [];
    return { group, prayers };
  }, [items]);
}

/** Perfect-day streak (every required item done) up to `today`, from your first item (max a year back). */
export function useDayStreak(today: string | null): DayStreak {
  const { store } = useStore();
  const version = useStoreVersion(store);
  return useMemo(() => {
    if (!store || !today) return { current: 0, best: 0 };
    const items = readItems(store);
    if (!items.length) return { current: 0, best: 0 };
    const first = items.reduce((min, i) => (i.createdAt < min ? i.createdAt : min), items[0].createdAt);
    const firstDay = toLocalDateString(new Date(first));
    const [y, m, d] = today.split("-").map(Number);
    const yearAgo = new Date(Date.UTC(y - 1, m - 1, d)).toISOString().slice(0, 10);
    const from = firstDay > yearAgo ? firstDay : yearAgo;
    const occs = store.query("occurrences", `WHERE "date" >= ? AND "date" <= ? AND "deleted_at" IS NULL`, [from, today]) as unknown as Occurrence[];
    return dayStreak(items, occs, from, today, store.getMeta("closed_through") || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version, today]);
}

/** An item's custom reminder rows (normally one; the latest live one applies). */
export function useItemReminders(itemId: string | null | undefined): Reminder[] {
  const { store } = useStore();
  const version = useStoreVersion(store);
  return useMemo(
    () => (store && itemId ? (store.query("reminders", `WHERE "item_id" = ? AND "deleted_at" IS NULL ORDER BY "updated_at" DESC`, [itemId]) as unknown as Reminder[]) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, itemId, version],
  );
}

/** Every live custom reminder, by item (for row bells). */
export function useCustomReminders(): Map<string, Reminder> {
  const { store } = useStore();
  const version = useStoreVersion(store);
  return useMemo(
    () => customReminders(store ? (store.query("reminders", `WHERE "deleted_at" IS NULL`) as unknown as Reminder[]) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, version],
  );
}
