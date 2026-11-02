"use client";

import type { GroupDetail, GroupsPayload } from "@life/shared";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/components/providers/store-provider";
import { useApi } from "./api";

/** Fetched (not synced) with the last copy kept for offline viewing. */
function useCached<T>(path: string | null, key: string) {
  const api = useApi();
  const { store } = useStore();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const reload = useCallback(async () => {
    if (!path) return;
    const r = await api<T>(path);
    if (r.ok) {
      setData(r.data);
      setError(null);
      setOffline(false);
      store?.setMeta(key, JSON.stringify(r.data));
      return;
    }
    if (r.status === 0) {
      setOffline(true);
      try {
        const raw = store?.getMeta(key);
        if (raw) setData(JSON.parse(raw) as T);
      } catch {
        /* ignore */
      }
    } else setError(r.message);
  }, [api, store, path, key]);

  useEffect(() => {
    void reload(); // eslint-disable-line react-hooks/set-state-in-effect -- load on mount
  }, [reload]);

  return { data, setData, error, offline, reload };
}

export const useGroups = () => useCached<GroupsPayload>("/v1/groups", "groups");
export const useGroup = (id: string | null) => useCached<GroupDetail>(id ? `/v1/groups/${id}` : null, `group_${id}`);
