"use client";

import {
  computeMonthlyPrayerReport,
  isFriday,
  isQuranLogDone,
  parsePrayerPayload,
  PRAYER_NAMES,
  todayLocalDate,
  type PrayerName,
  type PrayerStatus,
} from "@life/shared";
import { BookOpen } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { Card, CardTitle } from "@/components/ui/card";
import { StatNumber } from "@/components/ui/stat-number";
import { getLocalHabitLogs } from "@/lib/db/habit-logs-local";
import { getLocalDb } from "@/lib/db/local-db";
import {
  getLocalDefinitions,
  saveHabitLogLocally,
  syncWhenOnline,
} from "@/lib/sync/sync-engine";
import type { HabitDefinitionDto, HabitLogDto } from "@life/shared";

const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: "Fajr",
  zuhr: "Zuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

const NEXT_STATUS: Record<PrayerStatus, PrayerStatus> = {
  pending: "completed",
  completed: "missed",
  missed: "pending",
};

const STATUS_STYLES: Record<PrayerStatus, string> = {
  pending: "bg-surface-sunken text-ink-muted border-line",
  completed: "bg-success/15 text-success border-success/40",
  missed: "bg-danger/10 text-danger border-danger/30",
};

function defBySlug(defs: HabitDefinitionDto[], slug: string) {
  return defs.find((d) => d.slug === slug);
}

export function PrayerTracker() {
  const { refresh } = useAppData();
  const [definitions, setDefinitions] = useState<HabitDefinitionDto[]>([]);
  const [logs, setLogs] = useState<HabitLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const today = todayLocalDate();
  const friday = isFriday(today);

  const load = useCallback(async () => {
    setLoading(true);
    await syncWhenOnline();
    const db = await getLocalDb();
    setDefinitions(getLocalDefinitions(db));
    setLogs(await getLocalHabitLogs());
    setLoading(false);
  }, []);

  useEffect(() => {
    // Fetch-on-mount: setState happens after the internal `await`, not
    // synchronously within this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const prayerDef = defBySlug(definitions, "prayer");
  const mulkDef = defBySlug(definitions, "quran-mulk");
  const kahfDef = defBySlug(definitions, "quran-kahf");

  const prayerLog = logs.find(
    (l) => l.habitDefinitionId === prayerDef?.id && l.logDate === today,
  );
  const mulkLog = logs.find(
    (l) => l.habitDefinitionId === mulkDef?.id && l.logDate === today,
  );
  const kahfLog = logs.find(
    (l) => l.habitDefinitionId === kahfDef?.id && l.logDate === today,
  );

  const prayerPayload = parsePrayerPayload(prayerLog?.payload);
  const mulkDone = isQuranLogDone(mulkLog?.payload);
  const kahfDone = isQuranLogDone(kahfLog?.payload);

  async function cyclePrayer(name: PrayerName) {
    if (!prayerDef) return;
    const next = { ...prayerPayload, prayers: { ...prayerPayload.prayers } };
    next.prayers[name] = NEXT_STATUS[next.prayers[name]];
    setSaving(name);
    try {
      await saveHabitLogLocally(prayerDef.id, today, next);
      await load();
      await refresh();
    } finally {
      setSaving(null);
    }
  }

  async function toggleQuran(def: HabitDefinitionDto | undefined, currentlyDone: boolean) {
    if (!def) return;
    setSaving(def.slug);
    try {
      await saveHabitLogLocally(def.id, today, { completed: !currentlyDone });
      await load();
      await refresh();
    } finally {
      setSaving(null);
    }
  }

  const month = today.slice(0, 7);
  const report = useMemo(() => {
    if (!prayerDef) return null;
    const prayerLogs = logs
      .filter((l) => l.habitDefinitionId === prayerDef.id)
      .map((l) => ({ logDate: l.logDate, payload: l.payload }));
    return computeMonthlyPrayerReport(prayerLogs, month);
  }, [logs, prayerDef, month]);

  if (loading && definitions.length === 0) {
    return (
      <Card>
        <p className="text-sm text-ink-muted">Loading prayer & Quran tracker…</p>
      </Card>
    );
  }

  if (!prayerDef) {
    return (
      <Card>
        <p className="text-sm text-ink-muted">
          Waiting to sync your habits — connect once online, then come back.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Today&apos;s prayers</CardTitle>
        <p className="mt-1 text-xs text-ink-muted">Tap to cycle: pending → completed → missed.</p>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {PRAYER_NAMES.map((name) => {
            const status = prayerPayload.prayers[name];
            return (
              <button
                key={name}
                type="button"
                disabled={saving === name}
                onClick={() => void cyclePrayer(name)}
                aria-pressed={status === "completed"}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${STATUS_STYLES[status]}`}
              >
                <span>{PRAYER_LABELS[name]}</span>
                <span className="text-[10px] capitalize">{status}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="divide-y divide-line py-0">
        <button
          type="button"
          disabled={!mulkDef || saving === "quran-mulk"}
          onClick={() => void toggleQuran(mulkDef, mulkDone)}
          className="flex w-full items-center gap-3 py-3 text-sm font-medium text-ink transition-colors disabled:opacity-50"
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              mulkDone ? "bg-success/15 text-success" : "bg-surface-sunken text-ink-muted"
            }`}
          >
            <BookOpen className="h-4 w-4" />
          </span>
          <span className="flex-1 text-left">Surah Mulk (nightly)</span>
          <span className={mulkDone ? "text-success" : "text-ink-muted"}>
            {mulkDone ? "Done" : "Not yet"}
          </span>
        </button>

        <button
          type="button"
          disabled={!friday || !kahfDef || saving === "quran-kahf"}
          onClick={() => void toggleQuran(kahfDef, kahfDone)}
          aria-disabled={!friday}
          title={friday ? undefined : "Surah Kahf is tracked on Fridays only"}
          className="flex w-full items-center gap-3 py-3 text-sm font-medium text-ink transition-colors disabled:opacity-50"
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              !friday
                ? "bg-surface-sunken text-ink-muted/50"
                : kahfDone
                  ? "bg-success/15 text-success"
                  : "bg-surface-sunken text-ink-muted"
            }`}
          >
            <BookOpen className="h-4 w-4" />
          </span>
          <span className={`flex-1 text-left ${!friday ? "text-ink-muted" : ""}`}>
            Surah Kahf (Fridays)
          </span>
          <span className={friday && kahfDone ? "text-success" : "text-ink-muted"}>
            {friday ? (kahfDone ? "Done" : "Not yet") : "N/A today"}
          </span>
        </button>
      </Card>

      {report ? (
        <Card>
          <div className="flex items-start justify-between gap-2">
            <StatNumber
              value={`${report.completionPercent}%`}
              label={`${report.totalCompleted} of ${report.totalPossible} prayers this month`}
              size="md"
            />
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {report.days.map((day) => {
              const dayNum = Number(day.date.slice(-2));
              const bg =
                day.completed === day.total
                  ? "bg-success text-success-ink"
                  : day.completed > 0
                    ? "bg-warning text-warning-ink"
                    : "bg-surface-sunken text-ink-muted";
              return (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.completed}/${day.total}`}
                  className={`flex h-8 items-center justify-center rounded-lg text-[10px] font-medium ${bg}`}
                >
                  {dayNum}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
