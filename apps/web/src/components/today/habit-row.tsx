"use client";

import { bringBack, entryState, setDuration, setQuantity, toggleDone, checklistSteps, type Category, type DayEntry, type EntryState } from "@life/shared";
import { Check, ChevronDown, Flag, Lock, SkipForward } from "lucide-react";
import { createElement, useState, type ReactNode } from "react";
import { PopoverMenu, QuantityStepper } from "@/components/kit";
import { categoryIcon, formatTime } from "@/lib/v2/category-style";
import { shortDate } from "@/lib/v2/dates";
import { ChecklistSteps, useEntryRow } from "./entry-row";

/*
 * Today's simple list (owner mockup, 2026-11-25: "users find it too complex").
 * One card per list, one line per item: a square check, the category icon, the
 * title, and the amount on the right. Rows never jump between sections — a
 * finished item is struck through where it is. Tapping a row opens its
 * actions (skip, move, remind, edit, details); tapping an amount opens − / +.
 */

const fmt = (n: number) => n.toLocaleString("en-US");

type OnMenu = (entry: DayEntry, anchor: HTMLElement) => void;

/** A card with an icon tile and a title, holding a list of rows. */
export function ListCard({
  title,
  icon,
  tone = "primary",
  count,
  tour,
  children,
}: {
  title: string;
  icon: ReactNode;
  tone?: "primary" | "todo";
  /** e.g. "2/7" on the right of the title. */
  count?: string;
  tour?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} data-tour={tour} className="card p-3.5">
      <h2 className="mb-1 flex items-center gap-3">
        <span
          aria-hidden
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5 ${tone === "todo" ? "bg-todo/20 text-ink" : "bg-primary/15 text-primary-strong"}`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-ink">{title}</span>
        {count ? <span className="text-[13px] text-ink-2 tabular-nums">{count}</span> : null}
      </h2>
      <ul>{children}</ul>
    </section>
  );
}

/** A square check inside a 40px hit area: empty, started (small square), done (filled, ticked). */
function SquareCheck({ state, label, onToggle, disabled }: { state: EntryState; label: string; onToggle?: () => void; disabled?: boolean }) {
  const done = state === "done";
  const started = state === "in_progress";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done ? true : started ? "mixed" : false}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="press-pop -m-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-50"
    >
      <span
        aria-hidden
        className={`transition-token flex h-6 w-6 items-center justify-center rounded-[7px] border-[1.5px] ${
          done ? "border-primary-strong bg-primary-strong text-on-primary-strong" : started ? "border-primary-strong" : "border-ink-2/70"
        }`}
      >
        {done ? <Check className="h-4 w-4" strokeWidth={3} /> : started ? <span className="h-2.5 w-2.5 rounded-[3px] bg-primary-strong" /> : null}
      </span>
    </button>
  );
}

/** The quiet line under a title, only when it says something: overdue, a time, a prayer window, a wait. */
function metaLine(entry: DayEntry, opts: { dueLabel?: string; when?: string; lockedBy?: string; missed: boolean }): string {
  const item = entry.item;
  const parts: (string | null | undefined)[] = [];
  if (opts.missed) parts.push("Missed");
  parts.push(opts.dueLabel);
  if (opts.lockedBy) parts.push(`Waits for ${opts.lockedBy}`);
  if (item.schedule.kind === "once" && item.schedule.time) parts.push(formatTime(item.schedule.time));
  if (opts.when) parts.push(opts.when);
  if (entry.plan) parts.push(entry.plan.title);
  if (item.groupGoalId && typeof item.meta.groupName === "string") parts.push(`Group · ${item.meta.groupName}`);
  if (entry.occurrence?.detail?.late === true) parts.push("logged late");
  return parts.filter(Boolean).join(" · ");
}

type RowProps = {
  entry: DayEntry;
  /** The day this entry belongs to (actions write to that day). */
  date: string;
  category?: Category;
  onMenu: OnMenu;
  /** e.g. "Was due Fri 20 Nov" (Overdue). */
  dueLabel?: string;
  /** Replaces the right-hand side (e.g. "Move to today"). */
  aside?: ReactNode;
  /** A routine's sub-item: no icon, it sits under its routine. */
  nested?: boolean;
};

/** Divider between rows, starting under the icon like the mockup; none after the last row. */
const ROW = "group relative after:absolute after:right-0 after:bottom-0 after:left-10 after:h-px after:bg-border last:after:hidden";

/** The title button: opens the row's actions. Right-click does the same on a computer. */
function RowMain({ entry, category, meta, done, onMenu, nested, faded }: { entry: DayEntry; category?: Category; meta: string; done: boolean; onMenu: OnMenu; nested?: boolean; faded?: boolean }) {
  const priority = entry.item.priority === "critical" || entry.item.priority === "high" ? entry.item.priority : null;
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-label={`More actions for ${entry.item.title}`}
      onClick={(e) => onMenu(entry, e.currentTarget)}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(entry, e.currentTarget);
      }}
      className={`flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left ${faded ? "opacity-60" : ""}`}
    >
      {nested ? null : createElement(categoryIcon(category), { className: "h-5 w-5 shrink-0 text-ink", strokeWidth: 1.75, "aria-hidden": true })}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={`truncate ${nested ? "text-[14px]" : "text-[15px]"} ${done ? "text-ink-2 line-through" : "text-ink"}`}>{entry.item.title}</span>
          {priority ? <Flag className={`h-3.5 w-3.5 shrink-0 ${priority === "critical" ? "text-todo" : "text-progress"}`} fill="currentColor" role="img" aria-label={`${priority} priority`} /> : null}
        </span>
        {meta ? <span className="block truncate text-[12px] text-ink-2">{meta}</span> : null}
      </span>
    </button>
  );
}

/** One item: tick, count, minutes or checklist. */
function SingleRow({ entry, date, category, onMenu, dueLabel, aside, nested }: RowProps) {
  const { access, readOnly, lockedBy, tick, when, highlight, run } = useEntryRow(entry, date);
  const [amountAt, setAmountAt] = useState<HTMLElement | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const state = entryState(entry);
  const t = entry.item.tracking;
  const o = entry.occurrence;
  const notToday = state === "not_today";
  const missed = access === "history" && state !== "done" && !notToday && !dueLabel;
  const meta = metaLine(entry, { dueLabel, when, lockedBy, missed });

  let right: ReactNode = aside ?? null;
  if (!aside && notToday) {
    right =
      o?.status === "moved" && o.movedTo ? (
        <span className="text-[12.5px] text-ink-2">Moved to {shortDate(o.movedTo)}</span>
      ) : access !== "history" ? (
        <button type="button" onClick={() => void run((ctx) => bringBack(entry, date, ctx))} className="min-h-9 rounded-full px-2.5 text-[13px] font-medium text-link hover:bg-track">
          Bring back
        </button>
      ) : (
        <span className="text-[12.5px] text-ink-2">Skipped</span>
      );
  } else if (!aside && (t.kind === "quantity" || t.kind === "duration")) {
    const value = o?.value ?? 0;
    const target = t.kind === "quantity" ? t.target : t.targetMin;
    const unit = t.kind === "quantity" ? t.unit : "min";
    const text = `${fmt(value)}${target !== undefined ? ` / ${fmt(target)}` : ""}${unit ? ` ${unit}` : ""}`;
    right = readOnly ? (
      <span className="text-[13px] whitespace-nowrap text-ink-2 tabular-nums">{text}</span>
    ) : (
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Adjust ${entry.item.title}: ${text}`}
        onClick={(e) => setAmountAt(e.currentTarget)}
        className="-mr-1.5 min-h-9 rounded-full px-2 text-[13px] whitespace-nowrap text-ink-2 tabular-nums hover:bg-track hover:text-ink"
      >
        {text}
      </button>
    );
  } else if (!aside && t.kind === "checklist") {
    const ticked = checklistSteps(entry).filter(Boolean).length;
    right = (
      <button
        type="button"
        aria-expanded={showSteps}
        onClick={() => setShowSteps((v) => !v)}
        className="-mr-1.5 inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-[13px] whitespace-nowrap text-ink-2 tabular-nums hover:bg-track hover:text-ink"
      >
        {ticked} / {t.steps.length} steps
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showSteps ? "rotate-180" : ""}`} aria-hidden />
      </button>
    );
  }

  const setValue = (v: number) => void run((ctx) => (t.kind === "duration" ? setDuration(entry, date, v, ctx) : setQuantity(entry, date, v, ctx)));

  return (
    <li className={`${ROW} ${highlight ? "-mx-2 rounded-xl bg-primary/10 px-2" : ""}`} data-now={highlight || undefined}>
      <div className="flex items-center gap-3">
        {notToday ? (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-ink-2" aria-label="Not today" role="img">
            <SkipForward className="h-4 w-4" aria-hidden />
          </span>
        ) : lockedBy ? (
          <button type="button" onClick={tick} aria-label={`${entry.item.title}: locked — ${lockedBy}`} className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-2 hover:bg-track">
            <Lock className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <SquareCheck state={state} label={entry.item.title} onToggle={readOnly ? undefined : tick} disabled={readOnly} />
        )}
        <RowMain entry={entry} category={category} meta={meta} done={state === "done"} onMenu={onMenu} nested={nested} faded={notToday} />
        {right}
      </div>
      {showSteps ? (
        <div className="pb-2 pl-9">
          <ChecklistSteps entry={entry} date={date} readOnly={readOnly} />
        </div>
      ) : null}
      {amountAt && (t.kind === "quantity" || t.kind === "duration") ? (
        <PopoverMenu role="dialog" anchor={amountAt} onClose={() => setAmountAt(null)} label={entry.item.title}>
          <div className="space-y-1.5 px-1 pb-1.5">
            <QuantityStepper
              value={o?.value ?? 0}
              onChange={setValue}
              step={t.kind === "quantity" ? (t.step ?? 1) : 5}
              unit={t.kind === "quantity" ? t.unit : "min"}
              label={entry.item.title}
            />
            {(t.kind === "quantity" ? t.target : t.targetMin) !== undefined ? (
              <p className="text-center text-[12px] text-ink-2">
                Goal {fmt((t.kind === "quantity" ? t.target : t.targetMin) ?? 0)} {t.kind === "quantity" ? t.unit : "min"}
              </p>
            ) : null}
          </div>
        </PopoverMenu>
      ) : null}
    </li>
  );
}

/** A routine ("Gym — Push day"): ticks all its steps at once, and opens to tick them one by one. */
function RoutineRow({ entry, date, category, onMenu, dueLabel, aside }: RowProps) {
  const { readOnly, run } = useEntryRow(entry, date);
  const [open, setOpen] = useState(false);
  const kids = (entry.children ?? []).filter((c) => entryState(c) !== "not_today");
  const done = kids.filter((c) => entryState(c) === "done").length;
  const state = entryState(entry);
  const tickAll = () => {
    const finish = state !== "done";
    const toFlip = kids.filter((c) => (entryState(c) === "done") !== finish);
    void run(async (ctx) => {
      const changes: Awaited<ReturnType<typeof toggleDone>> = [];
      for (const c of toFlip) changes.push(...(await toggleDone(c, date, ctx)));
      return changes;
    });
  };
  return (
    <li className={ROW}>
      <div className="flex items-center gap-3">
        <SquareCheck state={state} label={entry.item.title} onToggle={readOnly || !kids.length ? undefined : tickAll} disabled={readOnly} />
        <RowMain entry={entry} category={category} meta={dueLabel ?? ""} done={state === "done"} onMenu={onMenu} />
        {aside ?? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${entry.item.title} steps: ${done} of ${kids.length} done`}
            onClick={() => setOpen((v) => !v)}
            className="-mr-1.5 inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-[13px] whitespace-nowrap text-ink-2 tabular-nums hover:bg-track hover:text-ink"
          >
            {done} / {kids.length}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        )}
      </div>
      {open ? (
        <ul className="pb-1 pl-9" aria-label={`${entry.item.title} steps`}>
          {(entry.children ?? []).map((c) => (
            <SingleRow key={c.key} entry={c} date={date} onMenu={onMenu} nested />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** One line of Today's list: a routine or a single item. */
export function HabitRow(props: RowProps) {
  return props.entry.children ? <RoutineRow {...props} /> : <SingleRow {...props} />;
}
