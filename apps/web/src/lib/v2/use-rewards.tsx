"use client";

import type { RewardsPayload } from "@life/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useStore } from "@/components/providers/store-provider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const CACHE = "rewards";
/** Re-read at least this often even when nothing was pushed (the day may have closed). */
const STALE_MS = 5 * 60_000;

type RewardsState = {
  /** The last rewards the server worked out (cached for offline); null until the first read. */
  rewards: RewardsPayload | null;
  refresh: () => Promise<void>;
  /** Badges celebrated: shown once. */
  markSeen: (ids: string[]) => Promise<void>;
};

const RewardsContext = createContext<RewardsState | null>(null);

/**
 * Points, streak and badges (Phase 8). The server works them out from synced
 * entries; this reads them after each sync that pushed something (or every few
 * minutes) and keeps the last copy in the store for offline use.
 */
export function RewardsProvider({ children }: { children: ReactNode }) {
  const { store, lastResult } = useStore();
  const { getAccessToken } = useAuth();
  const [rewards, setRewards] = useState<RewardsPayload | null>(null);
  const lastFetch = useRef(0);
  const current = useRef<RewardsPayload | null>(null);
  useEffect(() => {
    current.current = rewards;
  }, [rewards]);

  useEffect(() => {
    if (!store) return;
    try {
      const raw = store.getMeta(CACHE);
      if (raw) setRewards(JSON.parse(raw) as RewardsPayload); // eslint-disable-line react-hooks/set-state-in-effect -- the cached copy, once the store opens
    } catch {
      /* a bad cache is just ignored */
    }
  }, [store]);

  const api = useCallback(
    async (path: string, body?: unknown) => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await fetch(`${API_BASE}${path}`, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      return res.ok ? ((await res.json()) as unknown) : null;
    },
    [getAccessToken],
  );

  const refresh = useCallback(async () => {
    lastFetch.current = Date.now();
    try {
      const data = (await api("/v1/rewards")) as RewardsPayload | null;
      if (!data || typeof data.points !== "number") return;
      setRewards(data);
      store?.setMeta(CACHE, JSON.stringify(data));
    } catch {
      /* offline: keep the cached copy */
    }
  }, [api, store]);

  useEffect(() => {
    if (!lastResult?.ok) return;
    if (lastResult.pushed === 0 && Date.now() - lastFetch.current < STALE_MS) return;
    void refresh();
  }, [lastResult, refresh]);

  const markSeen = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return;
      // Side effects stay out of the state updater (updaters run during render).
      const r = current.current;
      if (r) {
        const next = { ...r, badges: r.badges.map((b) => (ids.includes(b.id) ? { ...b, seen: true } : b)) };
        setRewards(next);
        store?.setMeta(CACHE, JSON.stringify(next));
      }
      try {
        await api("/v1/rewards/seen", { badgeIds: ids });
      } catch {
        /* shown again next time; harmless */
      }
    },
    [api, store],
  );

  const value = useMemo(() => ({ rewards, refresh, markSeen }), [rewards, refresh, markSeen]);
  return <RewardsContext.Provider value={value}>{children}</RewardsContext.Provider>;
}

const NONE: RewardsState = { rewards: null, refresh: async () => {}, markSeen: async () => {} };

/** Rewards, or nothing outside the provider (tests, dev pages). */
export function useRewards(): RewardsState {
  return useContext(RewardsContext) ?? NONE;
}
