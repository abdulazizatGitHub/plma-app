"use client";

import { Button } from "@/components/ui/button";
import { useAppData } from "@/components/providers/app-data-provider";

export function SyncStatus() {
  const { habitDefinitions, localDbReady, syncOnline, lastSyncError, refresh } =
    useAppData();

  return (
    <div className="mt-3 space-y-2 text-sm">
      <p className="text-rose-800/80">
        Local SQLite: {localDbReady ? "ready" : "initializing…"}
      </p>
      <p className="text-rose-800/80">
        Habit templates cached:{" "}
        <span className="font-medium tabular-nums">{habitDefinitions}</span>
      </p>
      <p className={syncOnline ? "text-emerald-700" : "text-amber-800"}>
        Cloud sync: {syncOnline ? "online" : "offline or API unavailable"}
      </p>
      {lastSyncError ? (
        <p className="text-amber-800">{lastSyncError}</p>
      ) : null}
      <Button variant="secondary" className="w-full" onClick={() => void refresh()}>
        Sync now
      </Button>
    </div>
  );
}
