"use client";

import { Check, MoreHorizontal } from "lucide-react";
import { useRef, type ReactNode } from "react";
import type { RingSegment } from "./ring";

export type PrayerChipStatus = RingSegment;

export type PrayerChip = {
  key: string;
  label: string;
  status: PrayerChipStatus;
  /** Local time, e.g. "1:15 PM". */
  time?: string;
  /** It's this prayer's time now. */
  now?: boolean;
  /**
   * For an unmarked prayer today: "upcoming" (not started) or "unmarked" (its
   * time passed, not marked yet — neutral, never assumed qada).
   */
  pending?: "upcoming" | "unmarked";
};

/** Prayed = the theme's filled accent with a tick (owner mockup, 2026-11-25); qada and missed keep their status colours. */
const CHIP_STYLE: Record<PrayerChipStatus, string> = {
  done: "bg-primary-strong text-on-primary-strong border-transparent",
  qada: "bg-progress text-on-fill border-transparent",
  missed: "bg-surface text-ink border-todo",
  open: "bg-track text-ink border-transparent",
};

const STATUS_WORD: Record<PrayerChipStatus, string> = {
  done: "prayed",
  qada: "prayed late (qada)",
  missed: "missed",
  open: "not marked",
};

const PENDING_STYLE = {
  upcoming: "bg-track text-ink-2 border-transparent",
  unmarked: "bg-surface text-ink border-dashed border-ink-2",
} as const;

const LONG_PRESS_MS = 500;

type PrayerRowProps = {
  title?: string;
  /** Under the title, e.g. "Asr now · until 6:02 PM". */
  subtitle?: ReactNode;
  /** The header's icon tile (a mosque on Today). */
  icon?: ReactNode;
  prayers: PrayerChip[];
  /** One tap: open ↔ prayed. Any prayer, any order. */
  onToggle?: (key: string, anchor: HTMLElement) => void;
  /** Long-press (or right-click) a chip: Prayed late / Missed / Clear for that prayer. */
  onChipMore?: (key: string, anchor: HTMLElement) => void;
  /** The visible ⋯: all prayers' actions for the day. */
  onMore?: (anchor: HTMLElement) => void;
  /** Extra line at the bottom (e.g. "Times are for Karachi · Set location"). */
  footer?: ReactNode;
};

/**
 * The daily prayer card (owner mockup, 2026-11-25): an icon tile, the title and
 * "1/5", then one equal-width chip per prayer with its time. A prayed chip is
 * filled with a tick; the prayer whose time it is now gets a ring.
 */
export function PrayerRow({ title = "Daily prayers", subtitle, icon, prayers, onToggle, onChipMore, onMore, footer }: PrayerRowProps) {
  const prayed = prayers.filter((p) => p.status === "done" || p.status === "qada").length;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <section data-tour="prayers" className="card p-3.5" aria-label={title}>
      <div className="mb-3 flex items-center gap-3">
        {icon ? (
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary-strong [&>svg]:h-5 [&>svg]:w-5">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-semibold text-ink">{title}</h2>
          {subtitle ? <p className="truncate text-[12px] text-ink-2">{subtitle}</p> : null}
        </div>
        <span role="img" aria-label={`${prayed} of ${prayers.length} prayers prayed`} className="text-[16px] font-semibold text-link tabular-nums">
          {prayed}/{prayers.length}
        </span>
        {onMore ? (
          <button
            type="button"
            onClick={(e) => onMore(e.currentTarget)}
            aria-label={`More actions for ${title}`}
            className="-my-1 -mr-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-track hover:text-ink"
          >
            <MoreHorizontal className="h-4.5 w-4.5" aria-hidden />
          </button>
        ) : null}
      </div>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))] gap-1">
        {prayers.map((p) => {
          const marked = p.status === "done" || p.status === "qada";
          return (
            <li key={p.key} className="min-w-0">
              <button
                type="button"
                aria-pressed={marked}
                aria-label={`${p.label}, ${p.pending === "upcoming" ? "upcoming" : p.pending === "unmarked" ? "time passed, not marked" : STATUS_WORD[p.status]}${p.time ? `, ${p.time}` : ""}${p.now ? ", now" : ""}`}
                onPointerDown={(e) => {
                  if (!onChipMore) return;
                  const el = e.currentTarget;
                  longPressed.current = false;
                  clear();
                  timer.current = setTimeout(() => {
                    longPressed.current = true;
                    onChipMore(p.key, el);
                  }, LONG_PRESS_MS);
                }}
                onPointerUp={clear}
                onPointerLeave={clear}
                onPointerCancel={clear}
                onContextMenu={(e) => {
                  if (!onChipMore) return;
                  e.preventDefault();
                  onChipMore(p.key, e.currentTarget);
                }}
                onClick={(e) => {
                  // A long-press already opened the menu; don't also toggle.
                  if (longPressed.current) {
                    longPressed.current = false;
                    return;
                  }
                  onToggle?.(p.key, e.currentTarget);
                }}
                className={`transition-token press-pop relative flex min-h-13 w-full flex-col items-center justify-center rounded-xl border-[1.5px] px-0.5 py-1.5 leading-tight select-none ${
                  p.status === "open" && p.pending ? PENDING_STYLE[p.pending] : CHIP_STYLE[p.status]
                } ${p.now ? "ring-2 ring-primary-strong ring-offset-2 ring-offset-surface" : ""}`}
              >
                <span className="max-w-full truncate text-[12px] font-medium">{p.label}</span>
                {p.time ? <span className="mt-0.5 max-w-full truncate text-[11px] tabular-nums opacity-85">{p.time}</span> : null}
                {marked ? (
                  // A corner badge, so "Maghrib ✓" never has to fit on a phone-width chip.
                  <span aria-hidden className="absolute -top-1.5 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-strong text-on-primary-strong ring-2 ring-surface">
                    <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {footer ? <div className="mt-3 border-t border-border pt-2">{footer}</div> : null}
    </section>
  );
}
