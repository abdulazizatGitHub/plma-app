"use client";

import {
  BedDouble,
  Book,
  BookOpen,
  Dumbbell,
  Droplet,
  Footprints,
  GraduationCap,
  PhoneOff,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type ComponentType } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { DotCluster } from "@/components/ui/dot-cluster";
import { ListDivider, ListRow } from "@/components/ui/list-row";
import { StatNumber } from "@/components/ui/stat-number";
import { buildTodayDashboard } from "@/lib/dashboard/today-summary";
import { getLocalHabitLogs } from "@/lib/db/habit-logs-local";
import { getLocalDb } from "@/lib/db/local-db";
import { getLocalDefinitions, syncWhenOnline } from "@/lib/sync/sync-engine";

const ROW_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  quran: BookOpen,
  steps: Footprints,
  water: Droplet,
  exercise: Dumbbell,
  reading: Book,
  study: GraduationCap,
  "make-bed": BedDouble,
  "no-phone": PhoneOff,
};

const LINKED_ROWS = new Set(["prayer", "quran"]);

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
    <div>
      <div className="flex items-end justify-between gap-3">
        <StatNumber
          value={loading ? "–" : `${completionPercent}%`}
          label="completed today"
        />
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="mb-1.5 shrink-0 text-xs font-medium text-accent hover:opacity-80"
        >
          Refresh
        </button>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        {loading
          ? "Loading habits…"
          : syncOnline
            ? "Synced — tap Refresh after logging elsewhere."
            : "Offline — showing cached habits."}
      </p>

      <div className="mt-6 border-t-2 border-ink/10">
        {rows.map((item) => {
          const Icon = ROW_ICONS[item.key];
          const row = (
            <ListRow
              icon={
                item.key === "prayer" ? undefined : Icon ? <Icon className="h-4 w-4" /> : undefined
              }
              label={item.label}
              done={item.done}
              value={
                item.key === "prayer" && item.count ? (
                  <span className="flex items-center gap-2">
                    <DotCluster completed={item.count.completed} total={item.count.total} />
                    <span>{item.value}</span>
                  </span>
                ) : (
                  item.value
                )
              }
            />
          );
          return (
            <div key={item.key}>
              {LINKED_ROWS.has(item.key) ? (
                <Link href="/prayer" className="block">
                  {row}
                </Link>
              ) : (
                row
              )}
              <ListDivider />
            </div>
          );
        })}
      </div>
    </div>
  );
}
