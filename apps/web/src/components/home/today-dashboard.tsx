"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { Card, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { buildTodayDashboard } from "@/lib/dashboard/today-summary";
import { getLocalHabitLogs } from "@/lib/db/habit-logs-local";
import { getLocalDb } from "@/lib/db/local-db";
import {
  getLocalDefinitions,
  syncWhenOnline,
} from "@/lib/sync/sync-engine";

export function TodayDashboard() {
  const { syncOnline, refresh } = useAppData();
  const [completionPercent, setCompletionPercent] = useState(0);
  const [rows, setRows] = useState<
    ReturnType<typeof buildTodayDashboard>["rows"]
  >([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    await syncWhenOnline();
    const db = await getLocalDb();
    const definitions = getLocalDefinitions(db);
    const logs = await getLocalHabitLogs();
    const summary = buildTodayDashboard(definitions, logs);
    setRows(summary.rows);
    setCompletionPercent(summary.completionPercent);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Fetch-on-mount: setState happens after the internal `await`, not
    // synchronously within this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, syncOnline]);

  async function onRefresh() {
    await refresh();
    await load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <CardTitle>Today&apos;s progress</CardTitle>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="text-xs font-medium text-rose-500 hover:text-rose-600"
          >
            Refresh
          </button>
        </div>
        <ProgressBar value={completionPercent} label="Daily completion" />
        <p className="mt-2 text-xs text-rose-800/60">
          {loading
            ? "Loading habits…"
            : syncOnline
              ? "Synced with Supabase — tap Refresh after logging."
              : "Offline — showing cached habits."}
        </p>
      </Card>

      <ul className="space-y-2">
        {rows.map((item) => {
          const linkHref =
            item.key === "prayer" || item.key === "quran" ? "/prayer" : null;
          const row = (
            <Card className="flex items-center justify-between py-3">
              <span className="text-sm font-medium text-rose-950/90">
                {item.label}
              </span>
              <span
                className={`text-sm tabular-nums ${
                  item.done ? "text-emerald-600" : "text-rose-800/55"
                }`}
              >
                {item.value}
              </span>
            </Card>
          );
          return (
            <li key={item.key}>
              {linkHref ? (
                <Link href={linkHref} className="block">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
