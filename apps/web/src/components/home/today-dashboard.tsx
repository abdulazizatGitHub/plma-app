"use client";

import {
  BedDouble,
  BookOpen,
  Check,
  Dumbbell,
  Droplet,
  Footprints,
  Minus,
  PhoneOff,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type ComponentType } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { Card } from "@/components/ui/card";
import { DotCluster } from "@/components/ui/dot-cluster";
import { HistoryStrip } from "@/components/ui/history-strip";
import { StatNumber } from "@/components/ui/stat-number";
import {
  buildHabitHistoryStrips,
  buildTodayDashboard,
  todayLocalDate,
  type DashboardRow,
} from "@/lib/dashboard/today-summary";
import { getLocalHabitLogs } from "@/lib/db/habit-logs-local";
import { getLocalDb } from "@/lib/db/local-db";
import {
  getLocalDefinitions,
  saveHabitLogLocally,
  syncWhenOnline,
} from "@/lib/sync/sync-engine";

const BOOLEAN_KEYS = new Set(["exercise", "make-bed", "no-phone"]);

const ROW_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  quran: BookOpen,
  steps: Footprints,
  water: Droplet,
  exercise: Dumbbell,
  "make-bed": BedDouble,
  "no-phone": PhoneOff,
};

const ROW_SUBTITLES: Record<string, string> = {
  prayer: "Five daily prayers",
  quran: "Mulk nightly, Kahf on Fridays",
  steps: "Move toward today's goal",
  water: "Stay ahead of the day",
  exercise: "Thirty minutes moves the needle",
  "make-bed": "Tidy the bed, start clean",
  "no-phone": "One screen-free hour",
  reading: "Arrives with custom habits",
  study: "Arrives with custom habits",
};

export function TodayDashboard() {
  const { syncOnline, refresh } = useAppData();
  const [completionPercent, setCompletionPercent] = useState(0);
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [history, setHistory] = useState<Record<string, boolean[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    await syncWhenOnline();
    const db = await getLocalDb();
    const definitions = getLocalDefinitions(db);
    const logs = await getLocalHabitLogs();
    const summary = buildTodayDashboard(definitions, logs);
    setRows(summary.rows);
    setCompletionPercent(summary.completionPercent);
    setHistory(buildHabitHistoryStrips(definitions, logs));
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

  async function toggleBoolean(row: DashboardRow) {
    if (!row.habitDefinitionId) return;
    setSaving(row.key);
    try {
      await saveHabitLogLocally(row.habitDefinitionId, todayLocalDate(), {
        completed: !row.done,
      });
      await load();
      await refresh();
    } finally {
      setSaving(null);
    }
  }

  async function adjustCounter(row: DashboardRow, delta: number) {
    if (!row.habitDefinitionId || !row.counter) return;
    const next = Math.max(0, row.counter.actual + delta);
    setSaving(row.key);
    try {
      await saveHabitLogLocally(row.habitDefinitionId, todayLocalDate(), { value: next });
      await load();
      await refresh();
    } finally {
      setSaving(null);
    }
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

      <div className="mt-6 space-y-2.5">
        {rows.map((row) => (
          <HabitCard
            key={row.key}
            row={row}
            history={history[row.key]}
            saving={saving === row.key}
            onToggle={() => void toggleBoolean(row)}
            onAdjust={(delta) => void adjustCounter(row, delta)}
          />
        ))}
      </div>
    </div>
  );
}

function HabitCard({
  row,
  history,
  saving,
  onToggle,
  onAdjust,
}: {
  row: DashboardRow;
  history: boolean[] | undefined;
  saving: boolean;
  onToggle: () => void;
  onAdjust: (delta: number) => void;
}) {
  const Icon = ROW_ICONS[row.key];
  const isBooleanAction = BOOLEAN_KEYS.has(row.key) && row.habitDefinitionId;
  const isCounterAction = row.key === "water" && row.habitDefinitionId && row.counter;
  const unavailable = row.available === false;

  const inner = (
    <Card className={unavailable ? "opacity-60" : ""}>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            row.done ? "bg-success text-success-ink" : "bg-surface-sunken text-ink-muted"
          }`}
        >
          {row.done && !isBooleanAction ? (
            <Check className="h-4 w-4" />
          ) : Icon ? (
            <Icon className="h-4 w-4" />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{row.label}</p>
          <p className="truncate text-xs text-ink-muted">{ROW_SUBTITLES[row.key]}</p>
        </div>

        {row.key === "prayer" && row.count ? (
          <span className="flex items-center gap-2 text-sm tabular-nums text-ink-muted">
            <DotCluster completed={row.count.completed} total={row.count.total} />
            {row.value}
          </span>
        ) : isBooleanAction ? (
          <button
            type="button"
            disabled={saving}
            onClick={(e) => {
              e.preventDefault();
              onToggle();
            }}
            aria-pressed={row.done}
            aria-label={`${row.label}: ${row.done ? "completed" : "mark as done"}`}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-50 ${
              row.done
                ? "border-success bg-success text-success-ink"
                : "border-line text-transparent"
            }`}
          >
            <Check className="h-4 w-4" />
          </button>
        ) : isCounterAction && row.counter ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              disabled={saving || row.counter.actual <= 0}
              onClick={(e) => {
                e.preventDefault();
                onAdjust(-1);
              }}
              aria-label={`Remove one, currently ${row.counter.actual}`}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-muted disabled:opacity-30"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span
              className={`w-10 text-center text-sm tabular-nums ${row.done ? "text-success" : "text-ink-muted"}`}
            >
              {row.counter.actual}
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                onAdjust(1);
              }}
              aria-label={`Add one, currently ${row.counter.actual}`}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-muted disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span
            className={`shrink-0 text-sm tabular-nums ${row.done ? "text-success" : "text-ink-muted"}`}
          >
            {row.value}
          </span>
        )}
      </div>
      {history && !unavailable ? <HistoryStrip days={history} className="mt-3" /> : null}
    </Card>
  );

  if (row.key === "prayer" || row.key === "quran") {
    return (
      <Link href="/prayer" className="block">
        {inner}
      </Link>
    );
  }

  return inner;
}
