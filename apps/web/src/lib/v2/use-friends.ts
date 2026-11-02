"use client";

import type { FriendsPayload } from "@life/shared";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/components/providers/store-provider";
import { useApi } from "./api";

const CACHE = "social_friends";
const EMPTY: FriendsPayload = { friends: [], incoming: [], outgoing: [], blocked: [] };

/** Friends, requests and blocks (fetched; the last copy is kept for offline). */
export function useFriends() {
  const api = useApi();
  const { store } = useStore();
  const [data, setData] = useState<FriendsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const reload = useCallback(async () => {
    const r = await api<FriendsPayload>("/v1/friends");
    setLoading(false);
    if (r.ok) {
      setData(r.data);
      setOffline(false);
      store?.setMeta(CACHE, JSON.stringify(r.data));
    } else if (r.status === 0) {
      setOffline(true);
      try {
        const raw = store?.getMeta(CACHE);
        if (raw) setData(JSON.parse(raw) as FriendsPayload);
      } catch {
        /* ignore */
      }
    }
  }, [api, store]);

  useEffect(() => {
    void reload(); // eslint-disable-line react-hooks/set-state-in-effect -- load on mount
  }, [reload]);

  return { data: data ?? EMPTY, loaded: !!data, loading, offline, reload };
}
