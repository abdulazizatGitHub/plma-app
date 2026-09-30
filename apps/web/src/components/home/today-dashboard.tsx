"use client";

import type { PrayerName, PrayerStatus } from "@life/shared";
import {
  AlarmClock,
  BookOpen,
  Check,
  ChevronRight,
  Cloud,
  CloudOff,
  GlassWater,
  Minus,
  PartyPopper,
  Plus,
  RotateCw,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { HABIT_ICONS, PRAYER_ICONS, SECTION_ICONS } from "@/components/habits/habit-icons";
import { useAppData } from "@/components/providers/app-data-provider";
import { Card } from "@/components/ui/card";
import { CategoryBadge } from "@/components/ui/category-badge";
import { HistoryStrip } from "@/components/ui/history-strip";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SectionLabel } from "@/components/ui/section-label";
import { Skeleton } from "@/components/ui/skeleton";
import { WeeklyBars } from "@/components/ui/weekly-bars";
import {
  buildHabitHistoryStrips,
  buildTodayDashboard,
  buildWeeklyCompletion,
  todayLocalDate,
  type DashboardRow,
} from "@/lib/dashboard/today-summary";
import { getLocalHabitLogs } from "@/lib/db/habit-logs-local";
import { getLocalDb } from "@/lib/db/local-db";
import { nextPendingPrayer, withPrayerStatus } from "@/lib/prayer/prayer-actions";
import {
  getLocalDefinitions,
  saveHabitLogLocally,
  syncWhenOnline,
} from "@/lib/sync/sync-engine";
import { CATEGORY_BG, habitCategory } from "@/lib/theme/habit-category";

const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: "Fajr",
  zuhr: "Zuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

const SUBTITLES: Record<string, string> = {
  prayer: "Five daily prayers",
  quran: "Mulk nightly · Kahf Fridays",
  steps: "Daily step goal",
  water: "Glasses today",
  exercise: "Move for thirty minutes",
  sleep: "Last night",
  "make-bed": "Start the day clean",
  "no-phone": "One screen-free hour",
};

const SECTIONS: { index: string; title: string; icon: LucideIcon; keys: string[] }[] = [
  { index: "01", title: "Faith", icon: SECTION_ICONS.faith, keys: ["prayer", "quran"] },
  {
    index: "02",
    title: "Body",
    icon: SECTION_ICONS.body,
    keys: ["steps", "water", "exercise", "sleep"],
  },
  { index: "03", title: "Home & Mind", icon: SECTION_ICONS.mind, keys: ["make-bed", "no-phone"] },
];

const BOOLEAN_KEYS = new Set(["exercise", "make-bed", "no-phone"]);
const STEP_INCREMENT = 1000;

const STATUS_COLOR: Record<PrayerStatus, string | null> = {
  completed: "var(--success)",
  missed: "var(--danger)",
  pending: null,
};

function dateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const value = new Date(y, m - 1, d);
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(value);
  const dayMonth = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(
    value,
  );
  return `${weekday} · ${dayMonth}`;
}

export function TodayDashboard() {
  const { syncOnline, refresh } = useAppData();
  const [today, setToday] = useState<string | null>(null);
  const [completionPercent, setCompletionPercent] = useState(0);
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [history, setHistory] = useState<Record<string, boolean[]>>({});
  const [weekly, setWeekly] = useState<{ date: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  /** Reads the local store only — no network, so it's instant after a local write. */
  const readLocal = useCallback(async () => {
    // Computed client-side: "/" is statically prerendered, so a server-side
    // date would be frozen at build time.
    setToday(todayLocalDate());
    const db = await getLocalDb();
    const definitions = getLocalDefinitions(db);
    const logs = await getLocalHabitLogs();
    const summary = buildTodayDashboard(definitions, logs);
    setRows(summary.rows);
    setCompletionPercent(summary.completionPercent);
    setHistory(buildHabitHistoryStrips(definitions, logs));
    setWeekly(buildWeeklyCompletion(definitions, logs));
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
  }, [load, syncOnline]);

  async function onRefresh() {
    await refresh();
    await load();
  }

  async function save(key: string, habitDefinitionId: string, payload: Record<string, unknown>) {
    setSaving(key);
    try {
      await saveHabitLogLocally(habitDefinitionId, todayLocalDate(), payload);
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

  function markPrayer(row: DashboardRow, name: PrayerName, status: PrayerStatus) {
    if (!row.habitDefinitionId || !row.prayers) return;
    void save("prayer", row.habitDefinitionId, withPrayerStatus({ prayers: row.prayers }, name, status));
  }

  function setQuran(id: string | undefined, completed: boolean) {
    if (!id) return;
    void save("quran", id, { completed });
  }

  function toggleBoolean(row: DashboardRow) {
    if (!row.habitDefinitionId) return;
    // Keep any duration/type logged on /health when toggling from Home.
    const details: Record<string, unknown> = {};
    if (row.exercise?.durationMinutes) details.durationMinutes = row.exercise.durationMinutes;
    if (row.exercise?.type) details.type = row.exercise.type;
    void save(row.key, row.habitDefinitionId, { ...details, completed: !row.done });
  }

  function adjustCounter(row: DashboardRow, delta: number) {
    if (!row.habitDefinitionId || !row.counter) return;
    void save(row.key, row.habitDefinitionId, {
      value: Math.max(0, row.counter.actual + delta),
    });
  }

  const byKey = new Map(rows.map((r) => [r.key, r]));
  const tracked = rows.filter((r) => r.available !== false);
  const doneCount = tracked.filter((r) => r.done).length;
  const synced = rows.some((r) => r.habitDefinitionId || r.quran);
  const unavailable = rows.filter((r) => r.available === false);
  const weekAverage =
    weekly.length > 0 ? Math.round(weekly.reduce((s, d) => s + d.value, 0) / weekly.length) : 0;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={today ? dateLabel(today) : "Today"}
        title="Today"
        actions={
          <div className="flex items-center gap-3">
            <span className="label-mono flex items-center gap-1.5 text-ink-muted">
              {syncOnline ? (
                <Cloud className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <CloudOff className="h-3.5 w-3.5" aria-hidden />
              )}
              {syncOnline ? "Synced" : "Offline"}
            </span>
            <button
              type="button"
              onClick={() => void onRefresh()}
              aria-label="Refresh"
              className="press-pop transition-token flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink hover:bg-surface-sunken"
            >
              <RotateCw className="h-4 w-4" aria-hidden />
            </button>
          </div>
        }
      />

      {loading && rows.length === 0 ? (
        <DashboardSkeleton />
      ) : (
        <>
          <Card className="p-5">
            <div className="flex flex-col items-center gap-6 min-[400px]:flex-row min-[400px]:items-end">
              <ProgressRing
                size="lg"
                value={completionPercent}
                label={`${completionPercent}% of today's habits done`}
              >
                <span className="font-display text-5xl leading-none font-semibold tracking-tighter tabular-nums text-ink">
                  {completionPercent}%
                </span>
                <span className="label-mono mt-2 text-ink-muted">
                  {doneCount} of {tracked.length} done
                </span>
              </ProgressRing>
              <div className="w-full flex-1">
                <div className="mb-3 flex items-baseline justify-between">
                  <p className="label-mono text-ink">This week</p>
                  <p className="label-mono text-ink-muted">Avg {weekAverage}%</p>
                </div>
                <WeeklyBars days={weekly} max={100} formatValue={(v) => `${v}%`} />
              </div>
            </div>
          </Card>

          <UpNext
            rows={byKey}
            synced={synced}
            saving={saving !== null}
            onPrayer={markPrayer}
            onQuran={setQuran}
            onBoolean={toggleBoolean}
            onCounter={adjustCounter}
            onRefresh={() => void onRefresh()}
          />

          {SECTIONS.map((section) => (
            <section key={section.index} className="space-y-3">
              <SectionLabel index={section.index} title={section.title} icon={section.icon} />
              <div className="grid grid-cols-2 gap-3">
                {section.keys
                  .map((key) => byKey.get(key))
                  .filter((row): row is DashboardRow => Boolean(row))
                  .map((row, i, present) => (
                    <HabitTile
                      key={row.key}
                      row={row}
                      history={history[row.key]}
                      saving={saving === row.key}
                      // An odd last tile spans the row instead of leaving a hole.
                      className={present.length % 2 === 1 && i === present.length - 1 ? "col-span-2" : ""}
                      onPrayer={markPrayer}
                      onQuran={setQuran}
                      onBoolean={toggleBoolean}
                      onCounter={adjustCounter}
                    />
                  ))}
              </div>
            </section>
          ))}

          {unavailable.length > 0 ? (
            <div className="flex items-center gap-3 rounded-(--radius-card) border border-dashed border-line p-4">
              <div className="flex -space-x-2">
                {unavailable.map((row) => {
                  const Icon = HABIT_ICONS[row.key];
                  return (
                    <CategoryBadge
                      key={row.key}
                      category={row.key}
                      size="sm"
                      className="ring-2 ring-canvas"
                      icon={Icon ? <Icon className="h-4 w-4" /> : null}
                    />
                  );
                })}
              </div>
              <p className="text-sm text-ink-muted">
                {unavailable.map((r) => r.label).join(" & ")} arrive with custom habits.
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

type ActionHandlers = {
  onPrayer: (row: DashboardRow, name: PrayerName, status: PrayerStatus) => void;
  onQuran: (id: string | undefined, completed: boolean) => void;
  onBoolean: (row: DashboardRow) => void;
  onCounter: (row: DashboardRow, delta: number) => void;
};

/** An Up Next item either runs a one-tap action or, when input is needed, links to it. */
type UpNextItem = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  action: string;
} & ({ run: () => void; href?: never } | { href: string; run?: never });

/** Body habits have a detail section on /health, anchored by key. */
const HEALTH_KEYS = new Set(["steps", "water", "exercise", "sleep"]);

function pickUpNext(rows: Map<string, DashboardRow>, handlers: ActionHandlers): UpNextItem | null {
  const prayer = rows.get("prayer");
  if (prayer?.habitDefinitionId && prayer.prayers) {
    const next = nextPendingPrayer({ prayers: prayer.prayers });
    if (next) {
      return {
        icon: PRAYER_ICONS[next],
        title: `${PRAYER_LABELS[next]} prayer`,
        subtitle: `${prayer.count?.completed ?? 0} of 5 prayers done today`,
        action: `Mark ${PRAYER_LABELS[next]} as prayed`,
        run: () => handlers.onPrayer(prayer, next, "completed"),
      };
    }
  }

  const quran = rows.get("quran")?.quran;
  if (quran?.mulkId && !quran.mulkDone) {
    return {
      icon: BookOpen,
      title: "Surah Mulk",
      subtitle: "Tonight's recitation",
      action: "Mark Mulk as read",
      run: () => handlers.onQuran(quran.mulkId, true),
    };
  }
  if (quran?.friday && quran.kahfId && !quran.kahfDone) {
    return {
      icon: BookOpen,
      title: "Surah Kahf",
      subtitle: "It's Friday",
      action: "Mark Kahf as read",
      run: () => handlers.onQuran(quran.kahfId, true),
    };
  }

  const sleep = rows.get("sleep");
  if (sleep?.habitDefinitionId && sleep.sleep && !sleep.sleep.logged) {
    return {
      icon: HABIT_ICONS.sleep,
      title: "Last night's sleep",
      subtitle: `Wake goal ${sleep.sleep.wakeGoal}`,
      action: "Log sleep",
      href: "/health#sleep",
    };
  }

  for (const key of ["exercise", "make-bed", "no-phone"]) {
    const row = rows.get(key);
    if (row?.habitDefinitionId && !row.done) {
      return {
        icon: HABIT_ICONS[key],
        title: row.label,
        subtitle: SUBTITLES[key],
        action: `Mark ${row.label.toLowerCase()} done`,
        run: () => handlers.onBoolean(row),
      };
    }
  }

  const water = rows.get("water");
  if (water?.habitDefinitionId && water.counter && !water.done) {
    return {
      icon: GlassWater,
      title: "Water",
      subtitle: `${water.counter.actual} of ${water.counter.goal} glasses`,
      action: "Add a glass",
      run: () => handlers.onCounter(water, 1),
    };
  }

  return null;
}

function UpNext({
  rows,
  synced,
  saving,
  onRefresh,
  ...handlers
}: ActionHandlers & {
  rows: Map<string, DashboardRow>;
  synced: boolean;
  saving: boolean;
  onRefresh: () => void;
}) {
  const item = synced ? pickUpNext(rows, handlers) : null;
  const Icon = item?.icon ?? (synced ? PartyPopper : CloudOff);

  return (
    <div className="shadow-float rounded-(--radius-sheet) bg-ink p-5 text-canvas">
      <p className="label-mono opacity-70">{item ? "Up next" : synced ? "All done" : "Not synced"}</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-(--radius-control) bg-canvas/10">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[1.75rem] leading-[1.05] font-semibold tracking-[-0.03em]">
            {item ? item.title : synced ? "All done for today" : "Waiting to sync"}
          </p>
          <p className="mt-1 text-sm opacity-70">
            {item
              ? item.subtitle
              : synced
                ? "Every habit is logged. See you tomorrow."
                : "Connect once online so your habits load."}
          </p>
        </div>
      </div>
      {item?.href ? (
        <Link
          href={item.href}
          className="press-pop transition-token mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-(--radius-control) bg-accent px-4 text-base font-semibold text-accent-ink"
        >
          {item.action}
          <ChevronRight className="h-5 w-5" aria-hidden />
        </Link>
      ) : item ? (
        <button
          type="button"
          disabled={saving}
          onClick={item.run}
          className="press-pop transition-token mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-(--radius-control) bg-accent px-4 text-base font-semibold text-accent-ink disabled:opacity-60"
        >
          <Check className="h-5 w-5" aria-hidden />
          {item.action}
        </button>
      ) : !synced ? (
        <button
          type="button"
          onClick={onRefresh}
          className="press-pop transition-token mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-(--radius-control) bg-accent px-4 text-base font-semibold text-accent-ink"
        >
          <RotateCw className="h-5 w-5" aria-hidden />
          Try again
        </button>
      ) : null}
    </div>
  );
}

function HabitTile({
  row,
  history,
  saving,
  className = "",
  ...handlers
}: ActionHandlers & {
  row: DashboardRow;
  history: boolean[] | undefined;
  saving: boolean;
  className?: string;
}) {
  const Icon = HABIT_ICONS[row.key];
  const done = row.done;
  const category = habitCategory(row.key);

  return (
    <div
      className={`transition-token flex flex-col rounded-(--radius-card) border p-3.5 ${
        done
          ? `${CATEGORY_BG[category]} border-transparent text-cat-ink`
          : "shadow-card border-line/60 bg-surface text-ink"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        {done ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-(--radius-chip) bg-cat-ink text-white">
            {Icon ? <Icon className="h-5 w-5" aria-hidden /> : null}
          </span>
        ) : (
          <CategoryBadge category={row.key} icon={Icon ? <Icon className="h-5 w-5" /> : null} />
        )}
        <div className="flex items-center gap-1">
          {done ? (
            <span className="label-mono flex items-center gap-1 rounded-full bg-cat-ink/10 px-2 py-1">
              <Check className="h-3 w-3" aria-hidden />
              Done
            </span>
          ) : null}
          {HEALTH_KEYS.has(row.key) ? (
            <Link
              href={`/health#${row.key}`}
              aria-label={`${row.label} details`}
              className={`press-pop transition-token -mr-1.5 -mt-1.5 flex h-11 w-11 items-center justify-center rounded-full ${
                done ? "hover:bg-cat-ink/10" : "text-ink-muted hover:bg-surface-sunken"
              }`}
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-sm font-semibold">{row.label}</p>
      <p className={`text-xs ${done ? "opacity-70" : "text-ink-muted"}`}>{SUBTITLES[row.key]}</p>

      <div className="mt-3 flex flex-1 flex-col justify-end gap-3">
        <TileBody row={row} done={done} saving={saving} {...handlers} />
      </div>

      {history ? (
        <HistoryStrip days={history} className={`mt-3 ${done ? "text-cat-ink" : "text-ink"}`} />
      ) : null}
    </div>
  );
}

function Value({ children }: { children: ReactNode }) {
  return (
    <p className="font-display text-[1.75rem] leading-none font-semibold tracking-[-0.04em] tabular-nums">
      {children}
    </p>
  );
}

function tileButton(done: boolean, variant: "primary" | "quiet" = "primary") {
  const base =
    "press-pop transition-token flex min-h-11 items-center justify-center gap-1.5 rounded-(--radius-control) px-3 text-sm font-semibold disabled:opacity-50";
  if (done) return `${base} bg-cat-ink/10 text-cat-ink`;
  return variant === "primary"
    ? `${base} bg-ink text-canvas`
    : `${base} border border-line text-ink`;
}

function TileBody({
  row,
  done,
  saving,
  onQuran,
  onBoolean,
  onCounter,
}: ActionHandlers & { row: DashboardRow; done: boolean; saving: boolean }) {
  if (row.key === "prayer") {
    const prayers = row.prayers;
    return (
      <>
        <div className="flex items-center gap-3">
          <ProgressRing
            size="sm"
            label={`${row.count?.completed ?? 0} of 5 prayers done`}
            segments={
              prayers
                ? (["fajr", "zuhr", "asr", "maghrib", "isha"] as const).map(
                    (name) => STATUS_COLOR[prayers[name]],
                  )
                : [null, null, null, null, null]
            }
          >
            <span className="text-xs font-semibold tabular-nums">{row.count?.completed ?? 0}/5</span>
          </ProgressRing>
        </div>
        <Link href="/prayer" className={tileButton(done)}>
          Log prayers
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </>
    );
  }

  if (row.key === "quran") {
    const q = row.quran;
    const target =
      q && !q.mulkDone
        ? { id: q.mulkId, label: "Mulk" }
        : q?.friday && !q.kahfDone
          ? { id: q.kahfId, label: "Kahf" }
          : null;
    return (
      <>
        <Value>{row.value}</Value>
        {!q ? (
          <button type="button" disabled className={tileButton(done)}>
            Not synced
          </button>
        ) : target ? (
          <button
            type="button"
            disabled={saving || !target.id}
            onClick={() => onQuran(target.id, true)}
            className={tileButton(done)}
          >
            <Check className="h-4 w-4" aria-hidden />
            Read {target.label}
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => onQuran(q.friday && q.kahfDone ? q.kahfId : q.mulkId, false)}
            aria-label={`Undo ${q.friday && q.kahfDone ? "Kahf" : "Mulk"}`}
            className={tileButton(done)}
          >
            <Undo2 className="h-4 w-4" aria-hidden />
            Undo
          </button>
        )}
      </>
    );
  }

  if (row.counter && row.habitDefinitionId) {
    const isSteps = row.key === "steps";
    const step = isSteps ? STEP_INCREMENT : 1;
    const unit = isSteps ? "steps" : "glass";
    return (
      <>
        <Value>
          {isSteps ? row.counter.actual.toLocaleString() : row.counter.actual}
          <span className="text-base font-medium opacity-60">
            /{isSteps ? `${row.counter.goal / 1000}k` : row.counter.goal}
          </span>
        </Value>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={saving || row.counter.actual <= 0}
            onClick={() => onCounter(row, -step)}
            aria-label={`Remove ${isSteps ? "1,000 steps" : "one glass"}, currently ${row.counter.actual}`}
            className={tileButton(done, "quiet")}
          >
            <Minus className="h-4 w-4" aria-hidden />
            {isSteps ? "1k" : null}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onCounter(row, step)}
            aria-label={`Add ${isSteps ? "1,000 steps" : `one ${unit}`}, currently ${row.counter.actual}`}
            className={tileButton(done)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {isSteps ? "1k" : null}
          </button>
        </div>
      </>
    );
  }

  if (row.key === "sleep" && row.habitDefinitionId && row.sleep) {
    const logged = row.sleep.logged;
    return (
      <>
        <Value>{logged ? row.value : "—"}</Value>
        {logged ? (
          <p className="flex items-center gap-1 text-xs font-medium">
            <AlarmClock className="h-3.5 w-3.5" aria-hidden />
            Woke {logged.wakeClock}
            <span className="opacity-70">
              · {logged.wokeByGoal ? "on goal" : `goal ${row.sleep.wakeGoal}`}
            </span>
          </p>
        ) : null}
        <Link href="/health#sleep" className={tileButton(done)}>
          {logged ? "Edit" : "Log sleep"}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </>
    );
  }

  if (BOOLEAN_KEYS.has(row.key) && row.habitDefinitionId) {
    const details = row.key === "exercise" && done && row.value !== "Completed" ? row.value : null;
    return (
      <>
        {details ? <p className="text-sm font-semibold">{details}</p> : null}
        <button
          type="button"
          disabled={saving}
          onClick={() => onBoolean(row)}
          aria-pressed={done}
          aria-label={done ? `Undo ${row.label}` : `Mark ${row.label} done`}
          className={tileButton(done)}
        >
          {done ? <Undo2 className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
          {done ? "Undo" : "Mark done"}
        </button>
      </>
    );
  }

  return (
    <>
      <Value>{row.value}</Value>
      <button type="button" disabled className={tileButton(done)}>
        Not synced
      </button>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-7">
      <Skeleton className="h-52" />
      <Skeleton className="h-40" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  );
}
