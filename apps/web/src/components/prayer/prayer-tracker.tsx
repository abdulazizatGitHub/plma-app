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
import { BookOpen, Check, X } from "lucide-react";
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

const BEAD_STYLES: Record<PrayerStatus, string> = {
  pending: "border-line bg-surface text-ink-muted",
  completed: "border-success bg-success text-success-ink",
  missed: "border-danger bg-danger/15 text-danger",
};

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function defBySlug(defs: HabitDefinitionDto[], slug: string) {
  return defs.find((d) => d.slug === slug);
}

/** Index (0 = Monday) of the weekday `dateStr`'s month starts on, for calendar-grid padding. */
function leadingBlanksForMonth(monthStr: string): number {
  const [year, month] = monthStr.split("-").map(Number);
  const jsWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  return (jsWeekday + 6) % 7; // 0 = Monday
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
        <p className="mt-1 text-xs text-ink-muted">Tap a prayer to cycle its status.</p>
        <div className="relative mt-5 flex justify-between px-1">
          <div className="absolute top-5 right-5 left-5 h-px bg-line" aria-hidden />
          {PRAYER_NAMES.map((name) => {
            const status = prayerPayload.prayers[name];
            return (
              <button
                key={name}
                type="button"
                disabled={saving === name}
                onClick={() => void cyclePrayer(name)}
                aria-pressed={status === "completed"}
                aria-label={`${PRAYER_LABELS[name]}: ${status}`}
                className="relative z-10 flex flex-col items-center gap-1.5 disabled:opacity-50"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${BEAD_STYLES[status]}`}
                >
                  {status === "completed" ? (
                    <Check className="h-4 w-4" />
                  ) : status === "missed" ? (
                    <X className="h-4 w-4" />
                  ) : null}
                </span>
                <span className="text-[11px] font-medium text-ink-muted">
                  {PRAYER_LABELS[name]}
                </span>
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
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              mulkDone ? "bg-success text-success-ink" : "bg-surface-sunken text-ink-muted"
            }`}
          >
            {mulkDone ? <Check className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
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
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              !friday
                ? "bg-surface-sunken text-ink-muted/50"
                : kahfDone
                  ? "bg-success text-success-ink"
                  : "bg-surface-sunken text-ink-muted"
            }`}
          >
            {friday && kahfDone ? (
              <Check className="h-4 w-4" />
            ) : (
              <BookOpen className="h-4 w-4" />
            )}
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
          <StatNumber
            value={`${report.completionPercent}%`}
            label={`${report.totalCompleted} of ${report.totalPossible} prayers this month`}
            size="md"
          />
          <div className="mt-5 grid grid-cols-7 gap-1.5 text-center text-[10px] font-medium text-ink-muted">
            {WEEKDAY_LABELS.map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-7 gap-1.5">
            {Array.from({ length: leadingBlanksForMonth(month) }, (_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {report.days.map((day) => {
              const dayNum = Number(day.date.slice(-2));
              const isToday = day.date === today;
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
                  className={`flex h-8 items-center justify-center rounded-lg text-[10px] font-medium ${bg} ${
                    isToday ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""
                  }`}
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
