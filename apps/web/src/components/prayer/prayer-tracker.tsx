"use client";

import {
  computeMonthlyPrayerReport,
  countPrayersByStatus,
  isFriday,
  isQuranLogDone,
  parsePrayerPayload,
  PRAYER_NAMES,
  todayLocalDate,
  type HabitDefinitionDto,
  type HabitLogDto,
  type PrayerName,
  type PrayerStatus,
} from "@life/shared";
import { BookOpen, Check, Flame, HandHeart, PartyPopper, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PRAYER_ICONS } from "@/components/habits/habit-icons";
import { useAppData } from "@/components/providers/app-data-provider";
import { Card } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/category-badge";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SectionLabel } from "@/components/ui/section-label";
import { Stat } from "@/components/ui/stat";
import { Skeleton } from "@/components/ui/skeleton";
import { WeeklyBars } from "@/components/ui/weekly-bars";
import { getLocalHabitLogs } from "@/lib/db/habit-logs-local";
import { getLocalDb } from "@/lib/db/local-db";
import {
  nextPendingPrayer,
  prayerStreak,
  weeklyPrayerCounts,
  withPrayerStatus,
} from "@/lib/prayer/prayer-actions";
import {
  getLocalDefinitions,
  saveHabitLogLocally,
  syncWhenOnline,
} from "@/lib/sync/sync-engine";

const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: "Fajr",
  zuhr: "Zuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

const STATUS_COLOR: Record<PrayerStatus, string | null> = {
  completed: "var(--success)",
  missed: "var(--danger)",
  pending: null,
};

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

const PRIMARY =
  "press-pop transition-token flex min-h-11 items-center justify-center gap-1.5 rounded-(--radius-control) px-3.5 text-sm font-semibold disabled:opacity-50";

function defBySlug(defs: HabitDefinitionDto[], slug: string) {
  return defs.find((d) => d.slug === slug);
}

/** Index (0 = Monday) of the weekday the month starts on, for calendar-grid padding. */
function leadingBlanksForMonth(monthStr: string): number {
  const [year, month] = monthStr.split("-").map(Number);
  const jsWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  return (jsWeekday + 6) % 7; // 0 = Monday
}

function monthName(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(year, month - 1, 1));
}

export function PrayerTracker() {
  const { refresh } = useAppData();
  const [definitions, setDefinitions] = useState<HabitDefinitionDto[]>([]);
  const [logs, setLogs] = useState<HabitLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const today = todayLocalDate();
  const friday = isFriday(today);

  /** Reads the local store only — no network, so it's instant after a local write. */
  const readLocal = useCallback(async () => {
    const db = await getLocalDb();
    setDefinitions(getLocalDefinitions(db));
    setLogs(await getLocalHabitLogs());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await syncWhenOnline();
    await readLocal();
    setLoading(false);
  }, [readLocal]);

  useEffect(() => {
    // Fetch-on-mount: setState happens after the internal `await`, not
    // synchronously within this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const prayerDef = defBySlug(definitions, "prayer");
  const mulkDef = defBySlug(definitions, "quran-mulk");
  const kahfDef = defBySlug(definitions, "quran-kahf");

  const todayLog = (def: HabitDefinitionDto | undefined) =>
    def ? logs.find((l) => l.habitDefinitionId === def.id && l.logDate === today) : undefined;

  const prayerPayload = parsePrayerPayload(todayLog(prayerDef)?.payload);
  const counts = countPrayersByStatus(prayerPayload);
  const next = nextPendingPrayer(prayerPayload);
  const mulkDone = isQuranLogDone(todayLog(mulkDef)?.payload);
  const kahfDone = isQuranLogDone(todayLog(kahfDef)?.payload);

  async function save(key: string, def: HabitDefinitionDto, payload: Record<string, unknown>) {
    setSaving(key);
    try {
      await saveHabitLogLocally(def.id, today, payload);
      await readLocal();
    } finally {
      setSaving(null);
    }
    // Cloud sync runs in the background; the local write is already visible.
    void (async () => {
      await refresh();
      await readLocal();
    })();
  }

  function setPrayer(name: PrayerName, status: PrayerStatus) {
    if (!prayerDef) return;
    void save(name, prayerDef, withPrayerStatus(prayerPayload, name, status));
  }

  function setQuran(def: HabitDefinitionDto | undefined, completed: boolean) {
    if (!def) return;
    void save(def.slug, def, { completed });
  }

  const month = today.slice(0, 7);
  const report = prayerDef
    ? computeMonthlyPrayerReport(
        logs
          .filter((l) => l.habitDefinitionId === prayerDef.id)
          .map((l) => ({ logDate: l.logDate, payload: l.payload })),
        month,
      )
    : null;

  const week = prayerDef ? weeklyPrayerCounts(logs, prayerDef.id, today) : [];
  const weekTotal = week.reduce((s, d) => s + d.value, 0);
  const streak = prayerDef ? prayerStreak(logs, prayerDef.id, today) : 0;

  if (loading && definitions.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-72" />
        <Skeleton className="h-40" />
        <Skeleton className="h-80" />
      </div>
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

  const fullDays = report?.days.filter((d) => d.completed === d.total).length ?? 0;
  const missedPrayers = report?.days.reduce((s, d) => s + d.missed, 0) ?? 0;

  return (
    <div className="space-y-7">
      {/* Daily ring + week */}
      <Card className="p-5">
        <div className="flex flex-col items-center">
          <ProgressRing
            size="xl"
            label={`${counts.completed} of 5 prayers completed today`}
            segments={PRAYER_NAMES.map((name) => STATUS_COLOR[prayerPayload.prayers[name]])}
          >
            <HandHeart className="h-6 w-6 text-ink-muted" aria-hidden />
            <span className="mt-1 font-display text-6xl leading-none font-semibold tracking-tighter tabular-nums text-ink">
              {counts.completed}
              <span className="text-3xl text-ink-muted">/5</span>
            </span>
            <span className="label-mono mt-2 text-ink-muted">Prayers today</span>
          </ProgressRing>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Legend color="var(--success)" label={`${counts.completed} prayed`} />
            <Legend color="var(--danger)" label={`${counts.missed} missed`} />
            <Legend color={null} label={`${counts.pending} pending`} />
          </div>

          {streak > 0 ? (
            <p className="mt-3 flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">
              <Flame className="h-4 w-4" aria-hidden />
              {streak}-day streak
            </p>
          ) : null}
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <WeeklyBars days={week} max={5} formatValue={(v) => `${v}/5`} />
          <p className="mt-2 text-xs text-ink-muted">
            Last 7 days · {weekTotal} of {week.length * 5} prayed
          </p>
        </div>
      </Card>

      {/* Next up */}
      <div className="shadow-float rounded-(--radius-sheet) bg-ink p-5 text-canvas">
        {next ? (
          <>
            <NextUpTitle name={next} />
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={saving !== null}
                onClick={() => setPrayer(next, "completed")}
                aria-label={`Mark ${PRAYER_LABELS[next]} as prayed (next up)`}
                className={`${PRIMARY} min-h-12 flex-1 bg-accent text-base text-accent-ink`}
              >
                <Check className="h-5 w-5" aria-hidden />
                Mark as prayed
              </button>
              <button
                type="button"
                disabled={saving !== null}
                onClick={() => setPrayer(next, "missed")}
                aria-label={`Mark ${PRAYER_LABELS[next]} as missed (next up)`}
                className={`${PRIMARY} min-h-12 border border-canvas/25 text-canvas`}
              >
                <X className="h-5 w-5" aria-hidden />
                Missed
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-(--radius-control) bg-canvas/10">
              <PartyPopper className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="font-display text-[1.75rem] leading-[1.05] font-semibold tracking-[-0.03em]">
                All five logged
              </p>
              <p className="mt-1 text-sm opacity-70">Use Undo below to change any prayer.</p>
            </div>
          </div>
        )}
      </div>

      {/* Today's prayers */}
      <section className="space-y-3">
        <SectionLabel title="Today" />
        <Card className="divide-y divide-line py-1">
          {PRAYER_NAMES.map((name) => {
            const status = prayerPayload.prayers[name];
            const Icon = PRAYER_ICONS[name];
            return (
              <div key={name} className="flex items-center gap-3 py-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-(--radius-chip) ${
                    status === "completed"
                      ? "bg-success text-success-ink"
                      : status === "missed"
                        ? "bg-danger/15 text-danger"
                        : "bg-cat-prayer text-cat-ink"
                  }`}
                  aria-hidden
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-ink">{PRAYER_LABELS[name]}</p>
                  <StatusText status={status} />
                </div>
                {status === "pending" ? (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={saving !== null}
                      onClick={() => setPrayer(name, "completed")}
                      aria-label={`Mark ${PRAYER_LABELS[name]} as prayed`}
                      className={`${PRIMARY} bg-ink text-canvas`}
                    >
                      <Check className="h-4 w-4" aria-hidden />
                      Prayed
                    </button>
                    <button
                      type="button"
                      disabled={saving !== null}
                      onClick={() => setPrayer(name, "missed")}
                      aria-label={`Mark ${PRAYER_LABELS[name]} as missed`}
                      className={`${PRIMARY} w-11 border border-line px-0 text-ink`}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={saving !== null}
                    onClick={() => setPrayer(name, "pending")}
                    aria-label={`Undo ${PRAYER_LABELS[name]}`}
                    className={`${PRIMARY} border border-line text-ink`}
                  >
                    <Undo2 className="h-4 w-4" aria-hidden />
                    Undo
                  </button>
                )}
              </div>
            );
          })}
        </Card>
      </section>

      {/* Quran */}
      <section className="space-y-3">
        <SectionLabel title="Quran" />
        <Card className="divide-y divide-line py-1">
          <QuranRow
            title="Surah Mulk"
            subtitle="Every night"
            done={mulkDone}
            available={Boolean(mulkDef)}
            saving={saving === "quran-mulk"}
            onSet={(completed) => setQuran(mulkDef, completed)}
          />
          <QuranRow
            title="Surah Kahf"
            subtitle={friday ? "It's Friday" : "Fridays only"}
            done={friday && kahfDone}
            available={friday && Boolean(kahfDef)}
            saving={saving === "quran-kahf"}
            onSet={(completed) => setQuran(kahfDef, completed)}
          />
        </Card>
      </section>

      {/* Month */}
      {report ? (
        <section className="space-y-3">
          <SectionLabel title={monthName(month)} />
          <Card className="shadow-float p-5">
            <div className="grid grid-cols-3 gap-3">
              <Stat value={`${report.completionPercent}%`} label="Completed" />
              <Stat value={String(fullDays)} label="Full days" />
              <Stat value={String(missedPrayers)} label="Missed" />
            </div>

            <div className="mt-6 grid grid-cols-7 gap-1.5 text-center">
              {WEEKDAY_LABELS.map((w, i) => (
                <span key={i} className="label-mono text-ink-muted">
                  {w}
                </span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1.5">
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
                      : "bg-ink/5 text-ink-muted";
                return (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.completed}/${day.total}`}
                    className={`flex h-9 items-center justify-center rounded-(--radius-chip) text-xs font-semibold tabular-nums ${bg} ${
                      isToday ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                    }`}
                  >
                    {dayNum}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Legend color="var(--success)" label="All 5" />
              <Legend color="var(--warning)" label="Some" />
              <Legend color={null} label="None" />
            </div>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function NextUpTitle({ name }: { name: PrayerName }) {
  const Icon = PRAYER_ICONS[name];
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-12 w-12 items-center justify-center rounded-(--radius-control) bg-canvas/10">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <div>
        <p className="font-display text-[2.5rem] leading-none font-semibold tracking-[-0.04em]">
          {PRAYER_LABELS[name]}
        </p>
        <p className="mt-1 text-sm opacity-70">Next prayer</p>
      </div>
    </div>
  );
}

function StatusText({ status }: { status: PrayerStatus }) {
  if (status === "completed") {
    return (
      <p className="flex items-center gap-1 text-sm text-success">
        <Check className="h-3.5 w-3.5" aria-hidden />
        Prayed
      </p>
    );
  }
  if (status === "missed") {
    return (
      <p className="flex items-center gap-1 text-sm text-danger">
        <X className="h-3.5 w-3.5" aria-hidden />
        Missed
      </p>
    );
  }
  return <p className="text-sm text-ink-muted">Not logged yet</p>;
}

function QuranRow({
  title,
  subtitle,
  done,
  available,
  saving,
  onSet,
}: {
  title: string;
  subtitle: string;
  done: boolean;
  available: boolean;
  saving: boolean;
  onSet: (completed: boolean) => void;
}) {
  return (
    <div className={`flex items-center gap-3 py-3 ${available ? "" : "opacity-60"}`}>
      <CategoryBadge category="quran" icon={<BookOpen className="h-5 w-5" />} />
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-ink">{title}</p>
        <p className={`text-sm ${done ? "text-success" : "text-ink-muted"}`}>
          {done ? "Read today" : subtitle}
        </p>
      </div>
      <button
        type="button"
        disabled={!available || saving}
        onClick={() => onSet(!done)}
        aria-pressed={done}
        aria-label={done ? `Undo ${title}` : `Mark ${title} as read`}
        className={`${PRIMARY} ${done ? "border border-line text-ink" : "bg-ink text-canvas"}`}
      >
        {done ? <Undo2 className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
        {done ? "Undo" : available ? "Mark read" : "Fridays only"}
      </button>
    </div>
  );
}


function Legend({ color, label }: { color: string | null; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-muted">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: color ?? "color-mix(in srgb, var(--ink) 15%, transparent)" }}
        aria-hidden
      />
      {label}
    </span>
  );
}
