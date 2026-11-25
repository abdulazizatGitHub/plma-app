"use client";

import { bringBack, checklistSteps, entryState, toggleDone, type Category, type DayEntry, type EntryState } from "@life/shared";
import { Check, Flag, Lock } from "lucide-react";
import { createElement, useRef, type ReactNode } from "react";
import { Ring } from "@/components/kit";
import { categoryIcon, categoryTone, formatTime } from "@/lib/v2/category-style";
import { shortDate } from "@/lib/v2/dates";
import { useEntryRow } from "./entry-row";

/*
 * Today's items as cards (owner mockup, 2026-11-26): a pastel category tile,
 * the title with its amount underneath ("0 / 8 glasses"), and a round check on
 * the right. Tapping the card opens the item's page (log amounts, skip, move,
 * remind, edit, history); the circle ticks it. Rows never jump: done items are
 * struck through where they are.
 */

const fmt = (n: number) => n.toLocaleString("en-US");
const LONG_PRESS_MS = 500;

type OnMenu = (entry: DayEntry, anchor: HTMLElement) => void;

/** Progress toward done, 0–100: counts and minutes by value, checklists and routines by steps. */
function progressOf(entry: DayEntry): number {
  if (entry.children) {
    const kids = entry.children.filter((c) => entryState(c) !== "not_today");
    return kids.length ? (kids.filter((c) => entryState(c) === "done").length / kids.length) * 100 : 0;
  }
  const t = entry.item.tracking;
  const value = entry.occurrence?.value ?? 0;
  if (t.kind === "quantity" && t.target) return Math.min(100, (value / t.target) * 100);
  if (t.kind === "duration" && t.targetMin) return Math.min(100, (value / t.targetMin) * 100);
  if (t.kind === "checklist" && t.steps.length) return (checklistSteps(entry).filter(Boolean).length / t.steps.length) * 100;
  return entryState(entry) === "in_progress" ? 50 : 0;
}

/** "0 / 8 glasses", "2 / 5 steps"… then a time, a prayer window, a wait, a plan. */
function subtitleOf(entry: DayEntry, opts: { dueLabel?: string; when?: string; lockedBy?: string; missed: boolean }): string {
  const item = entry.item;
  const t = item.tracking;
  const o = entry.occurrence;
  const parts: (string | null | undefined)[] = [];
  if (opts.missed) parts.push("Missed");
  parts.push(opts.dueLabel);
  if (entry.children) {
    const kids = entry.children.filter((c) => entryState(c) !== "not_today");
    parts.push(`${kids.filter((c) => entryState(c) === "done").length} / ${kids.length} steps`);
  } else if (t.kind === "quantity") parts.push(`${fmt(o?.value ?? 0)}${t.target !== undefined ? ` / ${fmt(t.target)}` : ""} ${t.unit}`);
  else if (t.kind === "duration") parts.push(`${fmt(o?.value ?? 0)}${t.targetMin !== undefined ? ` / ${fmt(t.targetMin)}` : ""} min`);
  else if (t.kind === "checklist") parts.push(`${checklistSteps(entry).filter(Boolean).length} / ${t.steps.length} steps`);
  if (opts.lockedBy) parts.push(`Waits for ${opts.lockedBy}`);
  if (item.schedule.kind === "once" && item.schedule.time) parts.push(formatTime(item.schedule.time));
  if (opts.when) parts.push(opts.when);
  if (entry.plan) parts.push(entry.plan.title);
  if (item.groupGoalId && typeof item.meta.groupName === "string") parts.push(`Group · ${item.meta.groupName}`);
  if (o?.status === "skipped") parts.push("Skipped");
  if (o?.status === "moved" && o.movedTo) parts.push(`Moved to ${shortDate(o.movedTo)}`);
  if (o?.detail?.late === true) parts.push("logged late");
  return parts.filter(Boolean).join(" · ");
}

/** The round check on the right: empty, a ring filling with progress, or filled with a tick. */
function RoundCheck({ state, pct, label, onToggle, disabled }: { state: EntryState; pct: number; label: string; onToggle?: () => void; disabled?: boolean }) {
  const done = state === "done";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done ? true : state === "in_progress" ? "mixed" : false}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      onPointerDown={(e) => e.stopPropagation()}
      className="press-pop -m-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
    >
      {done ? (
        <span aria-hidden className="transition-token flex h-8 w-8 items-center justify-center rounded-full bg-primary-strong text-on-primary-strong">
          <Check className="h-4.5 w-4.5" strokeWidth={3} />
        </span>
      ) : pct > 0 ? (
        <Ring label="" value={pct} size={32} stroke={3} className="pointer-events-none" />
      ) : (
        <span aria-hidden className="h-8 w-8 rounded-full border-2 border-ink-2/45" />
      )}
    </button>
  );
}

type CardProps = {
  entry: DayEntry;
  /** The day this entry belongs to (actions write to that day). */
  date: string;
  category?: Category;
  /** Long-press or right-click: skip / move / remind / edit (the item's page has the visible ⋯). */
  onMenu: OnMenu;
  /** e.g. "Was due Tue 24 Nov" (Overdue). */
  dueLabel?: string;
  /** Replaces the round check (e.g. "Move to today"). */
  aside?: ReactNode;
};

/** One item as a card. */
export function ItemCard({ entry, date, category, onMenu, dueLabel, aside }: CardProps) {
  const { access, readOnly, lockedBy, tick, when, highlight, open, run } = useEntryRow(entry, date);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressed = useRef(false);
  const card = useRef<HTMLDivElement>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const state = entryState(entry);
  const notToday = state === "not_today";
  const missed = access === "history" && state !== "done" && !notToday && !dueLabel;
  const subtitle = subtitleOf(entry, { dueLabel, when, lockedBy, missed });
  const priority = entry.item.priority === "critical" || entry.item.priority === "high" ? entry.item.priority : null;
  const kids = (entry.children ?? []).filter((c) => entryState(c) !== "not_today");

  // A routine's circle ticks (or clears) all its steps at once.
  const toggle = entry.children
    ? () => {
        const finish = state !== "done";
        const flip = kids.filter((c) => (entryState(c) === "done") !== finish);
        void run(async (ctx) => {
          const changes: Awaited<ReturnType<typeof toggleDone>> = [];
          for (const c of flip) changes.push(...(await toggleDone(c, date, ctx)));
          return changes;
        });
      }
    : tick;

  let right: ReactNode;
  if (aside) right = aside;
  else if (notToday)
    right =
      entry.occurrence?.status === "skipped" && access !== "history" ? (
        <button type="button" onClick={() => void run((ctx) => bringBack(entry, date, ctx))} className="-mr-1 min-h-9 shrink-0 rounded-full px-3 text-[13px] font-medium text-link hover:bg-track">
          Bring back
        </button>
      ) : null;
  else if (lockedBy && !entry.children)
    right = (
      <button type="button" onClick={tick} aria-label={`${entry.item.title}: locked — ${lockedBy}`} className="-m-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-track">
        <Lock className="h-4.5 w-4.5" aria-hidden />
      </button>
    );
  else right = <RoundCheck state={state} pct={progressOf(entry)} label={entry.item.title} onToggle={readOnly || (entry.children && !kids.length) ? undefined : toggle} disabled={readOnly} />;

  return (
    <li>
      <div
        ref={card}
        data-now={highlight || undefined}
        className={`card flex items-center gap-3 p-3 pr-3.5 ${highlight ? "ring-2 ring-primary/60" : ""}`}
        onPointerDown={() => {
          pressed.current = false;
          clear();
          timer.current = setTimeout(() => {
            pressed.current = true;
            if (card.current) onMenu(entry, card.current);
          }, LONG_PRESS_MS);
        }}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => {
          e.preventDefault();
          onMenu(entry, e.currentTarget);
        }}
      >
        <button
          type="button"
          onClick={() => {
            // A long-press already opened the menu; don't also open the page.
            if (pressed.current) return void (pressed.current = false);
            open();
          }}
          className={`flex min-w-0 flex-1 items-center gap-3.5 text-left ${notToday ? "opacity-55" : ""}`}
        >
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: category ? `var(--cat-${categoryTone(category)})` : "var(--track)" }}>
            {createElement(categoryIcon(category), { className: "h-6 w-6 text-ink", strokeWidth: 1.75 })}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className={`truncate text-[16px] font-medium ${state === "done" ? "text-ink-2 line-through" : "text-ink"}`}>{entry.item.title}</span>
              {priority ? <Flag className={`h-3.5 w-3.5 shrink-0 ${priority === "critical" ? "text-todo" : "text-progress"}`} fill="currentColor" role="img" aria-label={`${priority} priority`} /> : null}
            </span>
            {subtitle ? <span className="mt-0.5 block truncate text-[13.5px] text-ink-2">{subtitle}</span> : null}
          </span>
        </button>
        {right}
      </div>
    </li>
  );
}
