"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { LocalStore } from "@/lib/v2/local-store";
import { syncOnce, type SyncResult } from "@/lib/v2/sync";
import { useAuth } from "./auth-provider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const SYNC_EVERY_MS = 60_000;

type StoreState = {
  store: LocalStore | null;
  syncing: boolean;
  lastResult: SyncResult | null;
  syncNow: () => Promise<void>;
  /** Debounced sync after a local edit. */
  syncSoon: () => void;
};

const StoreContext = createContext<StoreState | null>(null);

/**
 * Opens the signed-in user's v2 offline store and keeps it synced: on open,
 * when the device comes back online, when the tab becomes visible, and every
 * minute. v2 screens (Phase 2+) read and write through `useStore().store`.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, getAccessToken } = useAuth();
  const [store, setStore] = useState<LocalStore | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const running = useRef(false);
  const again = useRef(false);
  const soonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keyed by id: token refreshes create a new user object for the same account.
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let opened: LocalStore | null = null;
    let cancelled = false;
    void LocalStore.open(userId).then((s) => {
      if (cancelled) return s.close();
      opened = s;
      setStore(s);
    });
    return () => {
      cancelled = true;
      if (opened) void opened.flush().finally(() => opened?.close());
      setStore(null);
    };
  }, [userId]);

  const syncNow = useCallback(async () => {
    if (!store) return;
    if (running.current) {
      again.current = true; // a change arrived mid-sync: run once more afterwards
      return;
    }
    running.current = true;
    setSyncing(true);
    try {
      do {
        again.current = false;
        setLastResult(await syncOnce(store, { apiBase: API_BASE, getToken: getAccessToken }));
      } while (again.current);
    } finally {
      running.current = false;
      setSyncing(false);
    }
  }, [store, getAccessToken]);

  const syncSoon = useCallback(() => {
    if (soonTimer.current) clearTimeout(soonTimer.current);
    soonTimer.current = setTimeout(() => void syncNow(), 2000);
  }, [syncNow]);

  useEffect(() => {
    if (!store) return;
    void syncNow();
    const onOnline = () => void syncNow();
    const onVisible = () => document.visibilityState === "visible" && void syncNow();
    const onHide = () => void store.flush();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onHide);
    const timer = setInterval(() => void syncNow(), SYNC_EVERY_MS);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onHide);
      clearInterval(timer);
    };
  }, [store, syncNow]);

  return <StoreContext.Provider value={{ store, syncing, lastResult, syncNow, syncSoon }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
