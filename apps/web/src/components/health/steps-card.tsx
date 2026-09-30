"use client";

import {
  counterValue,
  dailySeries,
  lastNDates,
  periodDates,
  summarizeCounter,
} from "@life/shared";
import { Check, Target } from "lucide-react";
import { useId, useState } from "react";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Stat } from "@/components/ui/stat";
import { WeeklyBars } from "@/components/ui/weekly-bars";
import { GoalEditor } from "./goal-editor";
import {
  CHIP,
  CHIP_OFF,
  CHIP_ON,
  compactNumber,
  numberConfig,
  todayPayload,
  type HealthCardProps,
} from "./health-card-types";

const QUICK_ADD = [500, 1000, 2000];
const MAX_STEPS = 200_000;

export function StepsCard({ def, logs, today, period, busy, onLog, onGoal }: HealthCardProps) {
  const goal = numberConfig(def.config.goal, 10_000);
  const actual = counterValue(todayPayload(logs, def, today));
  const pct = Math.round((actual / goal) * 100);
  const dates = periodDates(period, today);
  const summary = summarizeCounter(logs, def.id, dates, goal);
  const week = dailySeries(logs, def.id, lastNDates(today), counterValue);
  const [exact, setExact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  function set(value: number) {
    onLog(def, { value: Math.min(MAX_STEPS, Math.max(0, Math.round(value))) });
  }

  function submitExact() {
    const n = Number(exact);
    if (exact.trim() === "" || !Number.isInteger(n) || n < 0 || n > MAX_STEPS) {
      setError(`Enter a whole number from 0 to ${MAX_STEPS.toLocaleString()}.`);
      return;
    }
    setError(null);
    set(n);
    setExact("");
  }

  return (
    <Card className="p-5">
      {/* Always stacked: at phone widths the card is too narrow for ring + controls side by side. */}
      <div className="flex flex-col items-center gap-5">
        <ProgressRing
          size="lg"
          value={pct}
          label={`${actual.toLocaleString()} of ${goal.toLocaleString()} steps today`}
        >
          <span className="font-display text-4xl leading-none font-semibold tracking-tighter tabular-nums text-ink">
            {actual.toLocaleString()}
          </span>
          <span className="label-mono mt-2 text-ink-muted">of {goal.toLocaleString()}</span>
        </ProgressRing>

        <div className="w-full space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {QUICK_ADD.map((n) => (
              <button
                key={n}
                type="button"
                disabled={busy}
                onClick={() => set(actual + n)}
                aria-label={`Add ${n.toLocaleString()} steps`}
                className={`${CHIP} ${CHIP_OFF}`}
              >
                +{compactNumber(n)}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitExact();
            }}
          >
            <label htmlFor={inputId} className="text-sm font-medium text-ink">
              Set today&apos;s total
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id={inputId}
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_STEPS}
                placeholder={actual.toLocaleString()}
                value={exact}
                onChange={(e) => setExact(e.target.value)}
                aria-invalid={error ? true : undefined}
                className="min-h-11 min-w-0 flex-1 rounded-(--radius-control) border border-line bg-surface px-3 text-base font-semibold text-ink tabular-nums"
              />
              <button
                type="submit"
                disabled={busy}
                className={`${CHIP} ${CHIP_ON}`}
              >
                <Check className="h-4 w-4" aria-hidden />
                Save
              </button>
            </div>
            {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
          </form>
        </div>
      </div>

      <p
        className={`mt-5 flex items-center gap-1.5 text-sm font-semibold ${
          actual >= goal ? "text-success" : "text-ink-muted"
        }`}
      >
        <Target className="h-4 w-4" aria-hidden />
        {actual >= goal
          ? "Goal reached today"
          : `${(goal - actual).toLocaleString()} steps to go`}
      </p>

      <div className="mt-5 border-t border-line pt-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat value={compactNumber(summary.average)} label="Avg / day" />
          <Stat value={`${summary.daysAtGoal}/${dates.length}`} label="Days at goal" />
          <Stat value={summary.best ? compactNumber(summary.best.value) : "—"} label="Best day" />
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-5">
        <WeeklyBars days={week} max={goal} formatValue={(v) => `${v.toLocaleString()} steps`} />
        <p className="mt-2 text-xs text-ink-muted">Last 7 days</p>
      </div>

      <div className="mt-5">
        <GoalEditor
          label="Daily goal"
          kind="number"
          value={String(goal)}
          format={(v) => `${Number(v).toLocaleString()} steps`}
          min={1000}
          max={100_000}
          step={500}
          disabled={busy}
          validate={(v) => {
            const n = Number(v);
            return Number.isInteger(n) && n >= 1000 && n <= 100_000
              ? null
              : "Pick a goal between 1,000 and 100,000.";
          }}
          onSave={(v) => onGoal(def, { goal: Number(v) })}
        />
      </div>
    </Card>
  );
}
