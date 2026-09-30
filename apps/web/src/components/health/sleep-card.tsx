"use client";

import {
  dailySeries,
  formatClock,
  formatDuration,
  isValidClock,
  lastNDates,
  localClockMinutes,
  parseSleepPayload,
  periodDates,
  sleepDurationMinutes,
  sleepLogPayloadSchema,
  sleepWindowFromClock,
  summarizeSleep,
  wokeByGoal,
  type SleepLogPayload,
} from "@life/shared";
import { AlarmClock, Bed, Check, MoonStar } from "lucide-react";
import { useId, useState } from "react";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { WeeklyBars } from "@/components/ui/weekly-bars";
import { DEFAULT_WAKE_GOAL } from "@/lib/dashboard/today-summary";
import { GoalEditor } from "./goal-editor";
import { CHIP, CHIP_ON, todayPayload, type HealthCardProps } from "./health-card-types";

const DEFAULT_BEDTIME = "23:00";

function minutesSlept(payload: unknown): number {
  const p = parseSleepPayload(payload);
  return p ? sleepDurationMinutes(p) : 0;
}

export function SleepCard(props: HealthCardProps) {
  const { def, logs, today, period, busy, onGoal } = props;
  const configured = def.config.wakeGoal;
  const wakeGoal =
    typeof configured === "string" && isValidClock(configured) ? configured : DEFAULT_WAKE_GOAL;
  const logged = parseSleepPayload(todayPayload(logs, def, today));
  const dates = periodDates(period, today);
  const summary = summarizeSleep(logs, def.id, dates, wakeGoal);
  const week = dailySeries(logs, def.id, lastNDates(today), minutesSlept);
  const weekMax = Math.max(9 * 60, ...week.map((d) => d.value));

  return (
    <Card className="p-5">
      {logged ? (
        <LoggedNight sleep={logged} wakeGoal={wakeGoal} />
      ) : (
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-(--radius-control) bg-cat-sleep text-cat-ink"
            aria-hidden
          >
            <MoonStar className="h-6 w-6" />
          </span>
          <div>
            <p className="font-display text-2xl leading-tight font-semibold tracking-[-0.03em] text-ink">
              Log last night
            </p>
            <p className="text-sm text-ink-muted">Wake goal {wakeGoal}</p>
          </div>
        </div>
      )}

      <SleepForm key={JSON.stringify(logged)} logged={logged} wakeGoal={wakeGoal} {...props} />

      <div className="mt-5 border-t border-line pt-5">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          <Stat
            value={summary.averageMinutes !== null ? formatDuration(summary.averageMinutes) : "—"}
            label="Avg sleep"
          />
          <Stat
            value={summary.averageWakeMinutes !== null ? formatClock(summary.averageWakeMinutes) : "—"}
            label="Avg wake-up"
          />
          <Stat value={`${summary.nightsOnGoal}/${summary.nights}`} label={`Up by ${wakeGoal}`} />
          <Stat
            value={summary.wakeSpreadMinutes !== null ? `±${summary.wakeSpreadMinutes}m` : "—"}
            label="Consistency"
          />
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-5">
        <WeeklyBars days={week} max={weekMax} formatValue={(v) => (v ? formatDuration(v) : "none")} />
        <p className="mt-2 text-xs text-ink-muted">Last 7 nights</p>
      </div>

      <div className="mt-5">
        <GoalEditor
          label="Wake goal"
          kind="time"
          value={wakeGoal}
          format={(v) => `Up by ${v}`}
          disabled={busy}
          validate={(v) => (isValidClock(v) ? null : "Pick a time like 06:00.")}
          onSave={(v) => onGoal(def, { wakeGoal: v })}
        />
      </div>
    </Card>
  );
}

function LoggedNight({ sleep, wakeGoal }: { sleep: SleepLogPayload; wakeGoal: string }) {
  const onGoal = wokeByGoal(sleep, wakeGoal);
  return (
    <div>
      <p className="font-display text-6xl leading-none font-semibold tracking-tighter tabular-nums text-ink">
        {formatDuration(sleepDurationMinutes(sleep))}
      </p>
      <p className="label-mono mt-2 text-ink-muted">Slept last night</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1.5 text-sm font-medium text-ink">
          <Bed className="h-4 w-4" aria-hidden />
          {formatClock(localClockMinutes(sleep.bedAt))}
        </span>
        <span className="text-ink-muted" aria-hidden>
          →
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1.5 text-sm font-medium text-ink">
          <AlarmClock className="h-4 w-4" aria-hidden />
          {formatClock(localClockMinutes(sleep.wakeAt))}
        </span>
        <span
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
            onGoal ? "bg-success text-success-ink" : "bg-warning text-warning-ink"
          }`}
        >
          {onGoal ? `Up by ${wakeGoal}` : `After ${wakeGoal}`}
        </span>
      </div>
    </div>
  );
}

function SleepForm({
  def,
  today,
  busy,
  onLog,
  logged,
  wakeGoal,
}: HealthCardProps & { logged: SleepLogPayload | null; wakeGoal: string }) {
  const [bed, setBed] = useState(
    logged ? formatClock(localClockMinutes(logged.bedAt)) : DEFAULT_BEDTIME,
  );
  const [wake, setWake] = useState(
    logged ? formatClock(localClockMinutes(logged.wakeAt)) : wakeGoal,
  );
  const [error, setError] = useState<string | null>(null);
  const bedId = useId();
  const wakeId = useId();

  const preview =
    isValidClock(bed) && isValidClock(wake)
      ? sleepDurationMinutes(sleepWindowFromClock(today, bed, wake))
      : null;

  function save() {
    if (!isValidClock(bed) || !isValidClock(wake)) {
      setError("Enter both times.");
      return;
    }
    const payload = sleepWindowFromClock(today, bed, wake);
    if (!sleepLogPayloadSchema.safeParse(payload).success) {
      setError("Those times don't make a valid night.");
      return;
    }
    setError(null);
    onLog(def, payload);
  }

  return (
    <form
      className="mt-5 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={bedId} className="block">
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <Bed className="h-3.5 w-3.5" aria-hidden />
            Bedtime
          </span>
          <input
            id={bedId}
            type="time"
            value={bed}
            onChange={(e) => setBed(e.target.value)}
            className="mt-1.5 min-h-12 w-full rounded-(--radius-control) border border-line bg-surface px-3 text-lg font-semibold text-ink tabular-nums"
          />
        </label>
        <label htmlFor={wakeId} className="block">
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <AlarmClock className="h-3.5 w-3.5" aria-hidden />
            Woke up
          </span>
          <input
            id={wakeId}
            type="time"
            value={wake}
            onChange={(e) => setWake(e.target.value)}
            className="mt-1.5 min-h-12 w-full rounded-(--radius-control) border border-line bg-surface px-3 text-lg font-semibold text-ink tabular-nums"
          />
        </label>
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <button type="submit" disabled={busy} className={`${CHIP} ${CHIP_ON} min-h-12 w-full text-base`}>
        <Check className="h-5 w-5" aria-hidden />
        {logged ? "Update sleep" : "Save sleep"}
        {preview !== null ? <span className="opacity-70">· {formatDuration(preview)}</span> : null}
      </button>
    </form>
  );
}
