"use client";

import {
  todayLocalDate,
  type HabitDefinitionDto,
  type HabitLogDto,
  type HealthPeriod,
} from "@life/shared";
import { Dumbbell, Footprints, GlassWater, MoonStar, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState, type ComponentType } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocalHabitLogs } from "@/lib/db/habit-logs-local";
import { getLocalDb } from "@/lib/db/local-db";
import {
  getLocalDefinitions,
  saveHabitLogLocally,
  syncWhenOnline,
  updateLocalDefinitionConfig,
} from "@/lib/sync/sync-engine";
import { ExerciseCard } from "./exercise-card";
import type { HealthCardProps } from "./health-card-types";
import { PeriodToggle } from "./period-toggle";
import { SleepCard } from "./sleep-card";
import { StepsCard } from "./steps-card";
import { WaterCard } from "./water-card";

const SECTIONS: {
  slug: string;
  id: string;
  index: string;
  title: string;
  icon: LucideIcon;
  Card: ComponentType<HealthCardProps>;
}[] = [
  { slug: "steps", id: "steps", index: "01", title: "Steps", icon: Footprints, Card: StepsCard },
  { slug: "water", id: "water", index: "02", title: "Water", icon: GlassWater, Card: WaterCard },
  { slug: "exercise", id: "exercise", index: "03", title: "Exercise", icon: Dumbbell, Card: ExerciseCard },
  { slug: "sleep", id: "sleep", index: "04", title: "Sleep", icon: MoonStar, Card: SleepCard },
];

export function HealthTracker() {
  const { refresh } = useAppData();
  const [definitions, setDefinitions] = useState<HabitDefinitionDto[]>([]);
  const [logs, setLogs] = useState<HabitLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<HealthPeriod>("week");

  const today = todayLocalDate();

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

  // Home links to /health#sleep etc.; the sections only exist once data loads,
  // so the browser's own hash scroll misses them. Scroll once they're rendered.
  useEffect(() => {
    if (loading || typeof window === "undefined" || !window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [loading]);

  async function write(task: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await task();
      await readLocal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save — try again.");
    } finally {
      setBusy(false);
    }
    // Cloud sync runs in the background; the local write is already visible.
    void (async () => {
      await refresh();
      await readLocal();
    })();
  }

  const onLog = (def: HabitDefinitionDto, payload: Record<string, unknown>) =>
    void write(() => saveHabitLogLocally(def.id, today, payload));

  const onGoal = (def: HabitDefinitionDto, patch: Record<string, unknown>) =>
    void write(() => updateLocalDefinitionConfig(def.id, patch));

  if (loading && definitions.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12" />
        <Skeleton className="h-96" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  const present = SECTIONS.map((s) => ({
    ...s,
    def: definitions.find((d) => d.slug === s.slug),
  }));

  if (present.every((s) => !s.def)) {
    return (
      <Card>
        <p className="text-sm text-ink-muted">
          Waiting to sync your habits — connect once online, then come back.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-7">
      <PeriodToggle value={period} onChange={setPeriod} />
      {error ? (
        <p role="alert" className="rounded-(--radius-control) bg-danger/15 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {present.map(({ id, index, title, icon, Card: SectionCard, def }) =>
        def ? (
          <section key={id} id={id} className="scroll-mt-4 space-y-3">
            <SectionLabel index={index} title={title} icon={icon} />
            <SectionCard
              def={def}
              logs={logs}
              today={today}
              period={period}
              busy={busy}
              onLog={onLog}
              onGoal={onGoal}
            />
          </section>
        ) : null,
      )}
    </div>
  );
}
