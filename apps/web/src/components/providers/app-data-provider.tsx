"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { syncWhenOnline } from "@/lib/sync/sync-engine";

type AppDataState = {
  habitDefinitions: number;
  localDbReady: boolean;
  syncOnline: boolean;
  lastSyncError: string | null;
  refresh: () => Promise<void>;
};

const AppDataContext = createContext<AppDataState | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [habitDefinitions, setHabitDefinitions] = useState(0);
  const [localDbReady, setLocalDbReady] = useState(false);
  const [syncOnline, setSyncOnline] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await syncWhenOnline();
      setHabitDefinitions(result.habits);
      setSyncOnline(result.online);
      setLocalDbReady(true);
      setLastSyncError(null);
    } catch (e) {
      setLastSyncError(e instanceof Error ? e.message : "Sync failed");
      setLocalDbReady(true);
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount: setState happens after the internal `await`, not
    // synchronously within this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const onOnline = () => void refresh();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refresh]);

  return (
    <AppDataContext.Provider
      value={{
        habitDefinitions,
        localDbReady,
        syncOnline,
        lastSyncError,
        refresh,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
