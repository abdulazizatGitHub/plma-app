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
import { DotCluster } from "@/components/ui/dot-cluster";
import { StatNumber } from "@/components/ui/stat-number";
import { buildTodayDashboard, todayLocalDate, type DashboardRow } from "@/lib/dashboard/today-summary";
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

export function TodayDashboard() {
  const { syncOnline, refresh } = useAppData();
  const [completionPercent, setCompletionPercent] = useState(0);
  const [rows, setRows] = useState<DashboardRow[]>([]);
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

      <div className="mt-6 border-t-2 border-ink/10">
        {rows.map((row) => (
          <Row
            key={row.key}
            row={row}
            saving={saving === row.key}
            onToggle={() => void toggleBoolean(row)}
            onAdjust={(delta) => void adjustCounter(row, delta)}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  row,
  saving,
  onToggle,
  onAdjust,
}: {
  row: DashboardRow;
  saving: boolean;
  onToggle: () => void;
  onAdjust: (delta: number) => void;
}) {
  const content = <RowContent row={row} saving={saving} onToggle={onToggle} onAdjust={onAdjust} />;

  if (row.key === "prayer" || row.key === "quran") {
    return (
      <Link href="/prayer" className="block border-b border-line">
        <div className="flex items-center gap-3 py-3.5">{content}</div>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-line py-3.5">{content}</div>
  );
}

function RowContent({
  row,
  saving,
  onToggle,
  onAdjust,
}: {
  row: DashboardRow;
  saving: boolean;
  onToggle: () => void;
  onAdjust: (delta: number) => void;
}) {
  if (row.key === "prayer") {
    return (
      <>
        <span className="flex-1 text-sm font-medium text-ink">{row.label}</span>
        <span className="flex items-center gap-2 text-sm tabular-nums text-ink-muted">
          {row.count ? <DotCluster completed={row.count.completed} total={row.count.total} /> : null}
          {row.value}
        </span>
      </>
    );
  }

  if (row.available === false) {
    return (
      <>
        <span className="flex-1 text-sm font-medium text-ink-muted">{row.label}</span>
        <span className="text-xs text-ink-muted/70">{row.value}</span>
      </>
    );
  }

  if (BOOLEAN_KEYS.has(row.key) && row.habitDefinitionId) {
    const Icon = ROW_ICONS[row.key];
    return (
      <>
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-ink-muted" /> : null}
        <span className="flex-1 text-sm font-medium text-ink">{row.label}</span>
        <button
          type="button"
          disabled={saving}
          onClick={onToggle}
          aria-pressed={row.done}
          aria-label={`${row.label}: ${row.done ? "completed" : "mark as done"}`}
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-50 ${
            row.done ? "border-success bg-success text-success-ink" : "border-line text-transparent"
          }`}
        >
          <Check className="h-4 w-4" />
        </button>
      </>
    );
  }

  if (row.key === "water" && row.habitDefinitionId && row.counter) {
    const Icon = ROW_ICONS[row.key];
    const atZero = row.counter.actual <= 0;
    return (
      <>
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-ink-muted" /> : null}
        <span className="flex-1 text-sm font-medium text-ink">{row.label}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving || atZero}
            onClick={() => onAdjust(-1)}
            aria-label={`Remove one glass of water, currently ${row.counter.actual}`}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-muted disabled:opacity-30"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span
            className={`w-16 text-right text-sm tabular-nums ${row.done ? "text-success" : "text-ink-muted"}`}
          >
            {row.value}
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={() => onAdjust(1)}
            aria-label={`Add one glass of water, currently ${row.counter.actual}`}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-muted disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </>
    );
  }

  const Icon = ROW_ICONS[row.key];
  return (
    <>
      {Icon ? <Icon className="h-4 w-4 shrink-0 text-ink-muted" /> : null}
      <span className="flex-1 text-sm font-medium text-ink">{row.label}</span>
      <span className={`text-sm tabular-nums ${row.done ? "text-success" : "text-ink-muted"}`}>
        {row.value}
      </span>
    </>
  );
}
