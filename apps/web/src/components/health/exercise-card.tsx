"use client";

import {
  EXERCISE_TYPES,
  dailySeries,
  lastNDates,
  parseExercisePayload,
  periodDates,
  summarizeExercise,
  type ExerciseLogPayload,
  type ExerciseType,
} from "@life/shared";
import { Check, Dumbbell, Undo2 } from "lucide-react";
import { useId, useState } from "react";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { WeeklyBars } from "@/components/ui/weekly-bars";
import { exerciseTypeLabel } from "@/lib/dashboard/today-summary";
import { CHIP, CHIP_OFF, CHIP_ON, todayPayload, type HealthCardProps } from "./health-card-types";

const DURATIONS = [15, 30, 45, 60, 90];

function minutesOf(payload: unknown): number {
  const p = parseExercisePayload(payload);
  return p?.completed ? (p.durationMinutes ?? 0) : 0;
}

export function ExerciseCard(props: HealthCardProps) {
  const { def, logs, today, period } = props;
  const logged = parseExercisePayload(todayPayload(logs, def, today));
  const dates = periodDates(period, today);
  const summary = summarizeExercise(logs, def.id, dates);
  const week = dailySeries(logs, def.id, lastNDates(today), minutesOf);
  const weekMax = Math.max(60, ...week.map((d) => d.value));

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-(--radius-control) ${
            logged?.completed ? "bg-success text-success-ink" : "bg-cat-move text-cat-ink"
          }`}
          aria-hidden
        >
          {logged?.completed ? <Check className="h-6 w-6" /> : <Dumbbell className="h-6 w-6" />}
        </span>
        <div>
          <p className="font-display text-2xl leading-tight font-semibold tracking-[-0.03em] text-ink">
            {logged?.completed ? "Done today" : "Not logged yet"}
          </p>
          <p className="text-sm text-ink-muted">
            {logged?.completed
              ? [
                  logged.durationMinutes ? `${logged.durationMinutes} min` : null,
                  logged.type ? exerciseTypeLabel(logged.type) : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No details added"
              : "Pick what you did, then save."}
          </p>
        </div>
      </div>

      {/* Remount the form whenever today's saved log changes so it starts from it. */}
      <ExerciseForm key={JSON.stringify(logged)} logged={logged} {...props} />

      <div className="mt-5 border-t border-line pt-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat value={`${summary.activeDays}/${dates.length}`} label="Active days" />
          <Stat value={String(summary.totalMinutes)} label="Minutes" />
          <Stat value={summary.topType ? exerciseTypeLabel(summary.topType) : "—"} label="Top type" />
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-5">
        <WeeklyBars days={week} max={weekMax} formatValue={(v) => `${v} min`} />
        <p className="mt-2 text-xs text-ink-muted">Last 7 days · minutes</p>
      </div>
    </Card>
  );
}

function ExerciseForm({
  def,
  busy,
  onLog,
  logged,
}: HealthCardProps & { logged: ExerciseLogPayload | null }) {
  const [type, setType] = useState<ExerciseType | undefined>(logged?.type);
  const [duration, setDuration] = useState<number | undefined>(logged?.durationMinutes);
  const [custom, setCustom] = useState(
    logged?.durationMinutes && !DURATIONS.includes(logged.durationMinutes)
      ? String(logged.durationMinutes)
      : "",
  );
  const customId = useId();

  function save(completed: boolean) {
    const payload: Record<string, unknown> = { completed };
    if (duration) payload.durationMinutes = duration;
    if (type) payload.type = type;
    onLog(def, payload);
  }

  return (
    <div className="mt-5 space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Type</legend>
        <div className="grid grid-cols-4 gap-2">
          {EXERCISE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(type === t ? undefined : t)}
              aria-pressed={type === t}
              className={`${CHIP} px-1 ${type === t ? CHIP_ON : CHIP_OFF}`}
            >
              {exerciseTypeLabel(t)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Duration</legend>
        <div className="grid grid-cols-5 gap-2">
          {DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setDuration(duration === m ? undefined : m);
                setCustom("");
              }}
              aria-pressed={duration === m && custom === ""}
              aria-label={`${m} minutes`}
              className={`${CHIP} px-1 ${duration === m && custom === "" ? CHIP_ON : CHIP_OFF}`}
            >
              {m}
            </button>
          ))}
        </div>
        <label htmlFor={customId} className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
          Other
          <input
            id={customId}
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            placeholder="min"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              const n = Number(e.target.value);
              setDuration(Number.isInteger(n) && n > 0 && n <= 1440 ? n : undefined);
            }}
            className="min-h-11 w-24 rounded-(--radius-control) border border-line bg-surface px-3 text-base font-semibold text-ink tabular-nums"
          />
          minutes
        </label>
      </fieldset>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => save(true)}
          className={`${CHIP} ${CHIP_ON} min-h-12 flex-1 text-base`}
        >
          <Check className="h-5 w-5" aria-hidden />
          {logged?.completed ? "Update workout" : "Save workout"}
        </button>
        {logged?.completed ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => save(false)}
            aria-label="Undo exercise"
            className={`${CHIP} ${CHIP_OFF} min-h-12`}
          >
            <Undo2 className="h-4 w-4" aria-hidden />
            Undo
          </button>
        ) : null}
      </div>
    </div>
  );
}
