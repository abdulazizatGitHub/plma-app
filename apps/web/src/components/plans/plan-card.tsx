"use client";

import { isPlanPreset, planProgress, type Item, type Occurrence } from "@life/shared";
import { AlertTriangle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { createElement } from "react";
import { Ring, Tag } from "@/components/kit";
import { formatTime } from "@/lib/v2/category-style";
import { whenLabel } from "@/lib/v2/dates";
import { PRESET_ICON } from "./plan-icons";

/** A plan in a list: preset icon, venue or course, progress ring, next step, overdue. */
export function PlanCard({ plan, steps, occs, today }: { plan: Item; steps: Item[]; occs: Occurrence[]; today: string }) {
  const p = planProgress(plan, steps, occs, today);
  const preset = isPlanPreset(plan.meta.preset) ? plan.meta.preset : "blank";
  const where = [plan.meta.venue, plan.meta.course].filter((v): v is string => typeof v === "string").join(" · ");
  const next = p.next;
  const nextWhen =
    next && next.schedule.kind === "once" && next.schedule.date
      ? `${whenLabel(next.schedule.date, today)}${next.schedule.time ? ` · ${formatTime(next.schedule.time)}` : ""}`
      : next
        ? "no date yet"
        : null;
  return (
    <Link href={`/plans/view?id=${plan.id}`} aria-label={plan.title} className="card flex items-center gap-3 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-track text-ink" aria-hidden>
        {createElement(PRESET_ICON[preset], { className: "h-4.5 w-4.5" })}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink">{plan.title}</span>
        {where ? <span className="block truncate text-[12px] text-ink-2">{where}</span> : null}
        <span className="mt-1 flex flex-wrap gap-1">
          {p.complete ? (
            <Tag tone="done">Complete</Tag>
          ) : next ? (
            <Tag>
              Next: {next.title}
              {nextWhen ? ` · ${nextWhen}` : ""}
            </Tag>
          ) : (
            <Tag>No steps yet</Tag>
          )}
          {p.overdue ? (
            <Tag tone="todo" icon={<AlertTriangle />}>
              {p.overdue} overdue
            </Tag>
          ) : null}
        </span>
      </span>
      <Ring label={`${plan.title}: ${p.done} of ${p.total} steps done`} value={p.pct} size={36} stroke={4} />
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-2" aria-hidden />
    </Link>
  );
}
