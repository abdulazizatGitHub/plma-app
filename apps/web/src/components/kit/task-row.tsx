"use client";

import { Flag, Lock, MoreHorizontal } from "lucide-react";
import { useRef, type ReactNode } from "react";
import type { ItemState } from "./status-tile";
import { TaskCheck } from "./task-check";

export type Priority = "low" | "medium" | "high" | "critical";

const PRIORITY_DOT: Record<Priority, string | null> = {
  low: null,
  medium: null,
  high: "bg-progress",
  critical: "bg-todo",
};

type TaskRowProps = {
  title: string;
  /** Caption line: time, category, "after Zuhr"… */
  meta?: string;
  state: ItemState;
  priority?: Priority;
  /** Category tone dot, as a CSS color (e.g. "var(--cat-mint)"). */
  categoryColor?: string;
  onToggle?: () => void;
  onOpen?: () => void;
  /** Opens Skip / Move / Pending / Edit, anchored to `anchor` (the ⋯ button, or the row on long-press). */
  onMore?: (anchor: HTMLElement) => void;
  /** Tag line under the title (category, time, priority…). Replaces `meta` and the priority dot. */
  tags?: ReactNode;
  /** Extra content under the title (e.g. a quantity stepper). */
  children?: ReactNode;
  /** It's this item's time now (inside its prayer or time window). */
  highlight?: boolean;
  /** Can't be ticked yet: shows a lock with this reason instead of the check (plan steps). */
  locked?: string;
  /** A day that can't be logged (history or future): the check shows the state but can't change it. */
  readOnly?: boolean;
  /**
   * Inside a grouped list card (Today, owner 2026-10-13): no card of its own,
   * a quiet meta line, a small flag for high / critical, and only real
   * signals (overdue, missed, waiting, reminder) as chips.
   */
  flat?: boolean;
  /** Chips under the meta line in flat rows: signals only. */
  badges?: ReactNode;
  /** A control on the right, before ⋯ (e.g. the + of a counted item). */
  aside?: ReactNode;
};

const LONG_PRESS_MS = 500;

/** One task card row. Long-press always has a visible ⋯ twin. */
export function TaskRow({
  title,
  meta,
  state,
  priority = "medium",
  categoryColor,
  onToggle,
  onOpen,
  onMore,
  tags,
  children,
  highlight = false,
  locked,
  readOnly = false,
  flat = false,
  badges,
  aside,
}: TaskRowProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const row = useRef<HTMLDivElement>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const dot = tags || flat ? null : PRIORITY_DOT[priority];
  const flag = flat && (priority === "high" || priority === "critical") ? priority : null;

  return (
    <div
      ref={row}
      data-now={highlight || undefined}
      className={`flex gap-2.5 px-3 py-2.5 ${flat ? "" : "card"} ${children || tags || badges ? "items-start" : "items-center"} ${
        highlight ? (flat ? "bg-primary/10" : "ring-2 ring-primary/70") : ""
      }`}
      onPointerDown={() => {
        if (!onMore) return;
        clear();
        timer.current = setTimeout(() => row.current && onMore(row.current), LONG_PRESS_MS);
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => {
        if (!onMore) return;
        e.preventDefault();
        onMore(e.currentTarget);
      }}
    >
      <div className={children || tags || badges ? "pt-0.5" : ""}>
        {locked ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={`${title}: locked — ${locked}`}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-track"
          >
            <Lock className="h-4 w-4" aria-hidden />
          </button>
        ) : (
          <TaskCheck state={state} label={title} onToggle={readOnly ? undefined : onToggle} disabled={readOnly} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          disabled={!onOpen}
          className="block w-full min-w-0 py-0.5 text-left disabled:cursor-default"
        >
          <span className="flex items-center gap-1.5">
            <span
              className={`block truncate text-[14px] leading-snug font-medium ${
                state === "done" ? "text-ink-2 line-through" : "text-ink"
              }`}
            >
              {title}
            </span>
            {flag ? (
              <Flag className={`h-3.5 w-3.5 shrink-0 ${flag === "critical" ? "text-todo" : "text-progress"}`} fill="currentColor" aria-label={`${flag} priority`} role="img" />
            ) : null}
          </span>
          {tags && !flat ? (
            <span className="mt-1 flex flex-wrap items-center gap-1">{tags}</span>
          ) : meta ? (
            <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-2">
              {categoryColor ? (
                <span aria-hidden className="h-2.5 w-2.5 rounded-full ring-1 ring-ink/25" style={{ background: categoryColor }} />
              ) : null}
              <span className="truncate">{meta}</span>
            </span>
          ) : null}
        </button>
        {badges ? <span className="mt-1 flex flex-wrap items-center gap-1">{badges}</span> : null}
        {children}
      </div>
      {dot ? (
        <span className={`h-2 w-2 shrink-0 rounded-full ${children ? "mt-3" : ""} ${dot}`} aria-label={`${priority} priority`} role="img" />
      ) : null}
      {aside}
      {onMore ? (
        <button
          type="button"
          onClick={(e) => onMore(e.currentTarget)}
          aria-label={`More actions for ${title}`}
          aria-haspopup="menu"
          className="-my-1 -mr-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-track"
        >
          <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
