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
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { Card, CardTitle } from "@/components/ui/card";
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
  pending: "bg-rose-50 text-rose-800/60 border-rose-100",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  missed: "bg-rose-100 text-rose-700 border-rose-200",
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
        <p className="text-sm text-rose-800/70">Loading prayer & Quran tracker…</p>
      </Card>
    );
  }

  if (!prayerDef) {
    return (
      <Card>
        <p className="text-sm text-rose-800/70">
          Waiting to sync your habits — connect once online, then come back.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Today&apos;s prayers</CardTitle>
        <p className="mt-1 text-xs text-rose-800/60">Tap to cycle: pending → completed → missed.</p>
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

      <Card>
        <CardTitle>Quran</CardTitle>
        <div className="mt-3 space-y-2">
          <button
            type="button"
            disabled={!mulkDef || saving === "quran-mulk"}
            onClick={() => void toggleQuran(mulkDef, mulkDone)}
            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
              mulkDone ? STATUS_STYLES.completed : STATUS_STYLES.pending
            }`}
          >
            <span>Surah Mulk (nightly)</span>
            <span>{mulkDone ? "Done" : "Not yet"}</span>
          </button>

          <button
            type="button"
            disabled={!friday || !kahfDef || saving === "quran-kahf"}
            onClick={() => void toggleQuran(kahfDef, kahfDone)}
            aria-disabled={!friday}
            title={friday ? undefined : "Surah Kahf is tracked on Fridays only"}
            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
              !friday
                ? "border-rose-100 bg-rose-50/50 text-rose-800/40"
                : kahfDone
                  ? STATUS_STYLES.completed
                  : STATUS_STYLES.pending
            }`}
          >
            <span>Surah Kahf (Fridays)</span>
            <span>{friday ? (kahfDone ? "Done" : "Not yet") : "N/A today"}</span>
          </button>
        </div>
      </Card>

      {report ? (
        <Card>
          <div className="flex items-center justify-between">
            <CardTitle>Monthly prayer report</CardTitle>
            <span className="text-xs font-semibold text-rose-700">
              {report.completionPercent}%
            </span>
          </div>
          <p className="mt-1 text-xs text-rose-800/60">
            {report.totalCompleted} of {report.totalPossible} prayers completed this month.
          </p>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {report.days.map((day) => {
              const dayNum = Number(day.date.slice(-2));
              const bg =
                day.completed === day.total
                  ? "bg-emerald-400"
                  : day.completed > 0
                    ? "bg-amber-300"
                    : "bg-rose-100";
              return (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.completed}/${day.total}`}
                  className={`flex h-8 items-center justify-center rounded-lg text-[10px] font-medium text-rose-950/70 ${bg}`}
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
