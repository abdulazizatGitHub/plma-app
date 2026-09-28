"use client";

import { Button } from "@/components/ui/button";
import { useAppData } from "@/components/providers/app-data-provider";

export function SyncStatus() {
  const { habitDefinitions, localDbReady, syncOnline, lastSyncError, refresh } =
    useAppData();

  return (
    <div className="mt-3 space-y-2 text-sm">
      <p className="text-ink-muted">
        Local SQLite: {localDbReady ? "ready" : "initializing…"}
      </p>
      <p className="text-ink-muted">
        Habit templates cached:{" "}
        <span className="font-medium tabular-nums text-ink">{habitDefinitions}</span>
      </p>
      <p className={syncOnline ? "text-success" : "text-warning"}>
        Cloud sync: {syncOnline ? "online" : "offline or API unavailable"}
      </p>
      {lastSyncError ? <p className="text-warning">{lastSyncError}</p> : null}
      <Button variant="secondary" className="w-full" onClick={() => void refresh()}>
        Sync now
      </Button>
    </div>
  );
}
