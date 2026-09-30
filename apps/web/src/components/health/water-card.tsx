"use client";

import {
  counterValue,
  dailySeries,
  lastNDates,
  periodDates,
  summarizeCounter,
} from "@life/shared";
import { GlassWater, Minus, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { WeeklyBars } from "@/components/ui/weekly-bars";
import { GoalEditor } from "./goal-editor";
import {
  CHIP,
  CHIP_OFF,
  CHIP_ON,
  numberConfig,
  todayPayload,
  type HealthCardProps,
} from "./health-card-types";

/** More glasses than this are still counted, just not drawn individually. */
const MAX_DRAWN = 16;

export function WaterCard({ def, logs, today, period, busy, onLog, onGoal }: HealthCardProps) {
  const goal = numberConfig(def.config.goal, 8);
  const actual = counterValue(todayPayload(logs, def, today));
  const drawn = Math.min(MAX_DRAWN, Math.max(goal, actual));
  const dates = periodDates(period, today);
  const summary = summarizeCounter(logs, def.id, dates, goal);
  const week = dailySeries(logs, def.id, lastNDates(today), counterValue);

  const set = (value: number) => onLog(def, { value: Math.max(0, value) });

  return (
    <Card className="p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-6xl leading-none font-semibold tracking-tighter tabular-nums text-ink">
            {actual}
            <span className="text-3xl text-ink-muted">/{goal}</span>
          </p>
          <p className="label-mono mt-2 text-ink-muted">Glasses today</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || actual <= 0}
            onClick={() => set(actual - 1)}
            aria-label={`Remove a glass, currently ${actual}`}
            className={`${CHIP} ${CHIP_OFF} w-11 px-0`}
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => set(actual + 1)}
            aria-label={`Add a glass, currently ${actual}`}
            className={`${CHIP} ${CHIP_ON}`}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Glass
          </button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {Array.from({ length: drawn }, (_, i) => {
          const filled = i < actual;
          // Tapping the last filled glass empties it; any other glass fills up to it.
          const next = actual === i + 1 ? i : i + 1;
          return (
            <button
              key={i}
              type="button"
              disabled={busy}
              onClick={() => set(next)}
              // Name each glass by identity (not by the resulting count), so no
              // two buttons share a name; aria-pressed carries its state.
              aria-label={`Glass ${i + 1} of ${goal}`}
              aria-pressed={filled}
              className={`press-pop transition-token flex h-14 items-center justify-center rounded-(--radius-control) disabled:opacity-60 ${
                filled
                  ? "bg-cat-water text-cat-ink"
                  : "border border-dashed border-line text-ink-muted hover:bg-surface-sunken"
              }`}
            >
              <GlassWater className="h-6 w-6" aria-hidden />
            </button>
          );
        })}
      </div>
      {actual > MAX_DRAWN ? (
        <p className="mt-2 text-xs text-ink-muted">+{actual - MAX_DRAWN} more logged</p>
      ) : null}

      <div className="mt-5 border-t border-line pt-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat value={String(summary.average)} label="Avg / day" />
          <Stat value={`${summary.daysAtGoal}/${dates.length}`} label="Days at goal" />
          <Stat value={String(summary.total)} label="Total glasses" />
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-5">
        <WeeklyBars days={week} max={goal} formatValue={(v) => `${v} glasses`} />
        <p className="mt-2 text-xs text-ink-muted">Last 7 days</p>
      </div>

      <div className="mt-5">
        <GoalEditor
          label="Daily goal"
          kind="number"
          value={String(goal)}
          format={(v) => `${v} glasses`}
          min={1}
          max={20}
          step={1}
          disabled={busy}
          validate={(v) => {
            const n = Number(v);
            return Number.isInteger(n) && n >= 1 && n <= 20 ? null : "Pick 1 to 20 glasses.";
          }}
          onSave={(v) => onGoal(def, { goal: Number(v) })}
        />
      </div>
    </Card>
  );
}
