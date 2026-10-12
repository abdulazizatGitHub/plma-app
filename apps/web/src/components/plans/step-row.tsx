"use client";

import { STEP_KINDS, checkCadence, stepKindOf, todayLocalDate, type CadenceRule, type Item, type Occurrence } from "@life/shared";
import { Check, Lock, MoreHorizontal } from "lucide-react";
import { createElement } from "react";
import { DateField, Tag, TimeField } from "@/components/kit";
import { useToday } from "@/lib/v2/use-today";
import { formatTime } from "@/lib/v2/category-style";
import { shortDate } from "@/lib/v2/dates";
import { stepIcon } from "./plan-icons";

type StepRowProps = {
  step: Item;
  plan: Item;
  done: boolean;
  waitingFor: Item[];
  rules: CadenceRule[];
  /** Steps that can conflict with this one (this plan's, and the category's other plans'). */
  peers: Item[];
  occurrence: Occurrence | null;
  onToggle: () => void;
  onDate: (date: string | null, time: string | null) => void;
  onMore: (anchor: HTMLElement) => void;
};

/**
 * One step on the plan timeline (PLN-01/02/04): tick (or lock + reason), kind,
 * title, date and time, and cadence warnings with suggested dates. Rules
 * warn and suggest; the picked date is saved either way.
 */
export function StepRow({ step, plan, done, waitingFor, rules, peers, onToggle, onDate, onMore }: StepRowProps) {
  const today = useToday() ?? todayLocalDate();
  const kind = stepKindOf(step);
  const s = step.schedule.kind === "once" ? step.schedule : { date: null, time: undefined };
  const date = s.date;
  const time = s.time ?? null;
  const cadence = date && !done ? checkCadence(date, { step, plan, rules, peers }) : { warnings: [], suggestions: [] };
  const locked = waitingFor.length > 0 && !done;
  const course = typeof step.meta.course === "string" ? step.meta.course : null;

  return (
    <li className="card space-y-2 p-3" aria-label={step.title}>
      <div className="flex items-start gap-2.5">
        {locked ? (
          <span
            role="img"
            aria-label={`Locked: waits for ${waitingFor.map((w) => w.title).join(", ")}`}
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-track text-ink-2"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : (
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={step.title}
            onClick={onToggle}
            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-done bg-done text-on-fill" : "border-border hover:border-primary-strong"}`}
          >
            {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : null}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className={`flex items-center gap-1.5 text-[14px] font-medium ${done ? "text-ink-2 line-through" : "text-ink"}`}>
            <span className="text-ink-2" aria-hidden>
              {createElement(stepIcon(kind), { className: "h-3.5 w-3.5" })}
            </span>
            <span className="truncate">{step.title}</span>
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {kind !== "custom" && STEP_KINDS[kind].label !== step.title ? <Tag>{STEP_KINDS[kind].label}</Tag> : null}
            {date ? <Tag>{`${shortDate(date)}${time ? ` · ${formatTime(time)}` : ""}`}</Tag> : <Tag>No date yet</Tag>}
            {course ? <Tag>{course}</Tag> : null}
            {locked ? <Tag icon={<Lock />}>Waits for {waitingFor.map((w) => w.title).join(", ")}</Tag> : null}
          </div>
        </div>
        <button
          type="button"
          aria-label={`More actions for ${step.title}`}
          onClick={(e) => onMore(e.currentTarget)}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-track hover:text-ink"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {!done ? (
        <div className="flex flex-wrap items-center gap-2 pl-9.5">
          <DateField
            label={`${step.title} date`}
            hideLabel
            size="sm"
            floating
            optional
            quick
            placeholder="Add date"
            today={today}
            value={date ?? ""}
            onChange={(v) => onDate(v || null, v ? time : null)}
          />
          {date ? (
            <TimeField
              label={`${step.title} time`}
              hideLabel
              size="sm"
              floating
              optional
              placeholder="Add time"
              value={time ?? ""}
              onChange={(v) => onDate(date, v || null)}
            />
          ) : null}
        </div>
      ) : null}

      {cadence.warnings.length ? (
        <div role="status" className="ml-9.5 space-y-1.5 rounded-xl bg-progress/20 p-2.5">
          {cadence.warnings.map((w) => (
            <p key={w} className="text-[12px] text-ink">
              {w}
            </p>
          ))}
          {cadence.suggestions.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-ink-2">Try:</span>
              {cadence.suggestions.map((d) => (
                <button key={d} type="button" onClick={() => onDate(d, time)} className="min-h-7 rounded-full bg-surface px-2.5 text-[12px] font-medium text-link hover:bg-track">
                  {shortDate(d)}
                </button>
              ))}
              <span className="text-[11.5px] text-ink-2">or keep {date ? shortDate(date) : "it"} — it&apos;s saved.</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
