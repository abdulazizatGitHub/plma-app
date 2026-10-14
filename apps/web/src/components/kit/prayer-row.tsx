"use client";

import { MoreHorizontal } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Ring, type RingSegment } from "./ring";

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

const CHIP_STYLE: Record<PrayerChipStatus, string> = {
  done: "bg-done text-on-fill border-transparent",
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
  upcoming: "bg-track text-ink-2 border-transparent opacity-70",
  unmarked: "bg-surface text-ink border-dashed border-ink-2",
} as const;

const LONG_PRESS_MS = 500;

type PrayerRowProps = {
  title?: string;
  /** Under the title, e.g. "Asr now · until 6:02 PM". */
  subtitle?: ReactNode;
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

/** The daily prayer block: segmented ring + one chip per prayer (owner S14–S15, PRY-03). */
export function PrayerRow({ title = "Daily prayers", subtitle, prayers, onToggle, onChipMore, onMore, footer }: PrayerRowProps) {
  const prayed = prayers.filter((p) => p.status === "done" || p.status === "qada").length;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <section data-tour="prayers" className="card p-3" aria-label={title}>
      <div className="flex items-center gap-3">
        <Ring label={`${prayed} of ${prayers.length} prayers prayed`} segments={prayers.map((p) => p.status)} size={52} stroke={6}>
          <span className="text-[13px] font-semibold text-ink">
            {prayed}/{prayers.length}
          </span>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[14px] font-medium text-ink">{title}</h3>
              {subtitle ? <p className="truncate text-[12px] text-ink-2">{subtitle}</p> : null}
            </div>
            {onMore ? (
              <button
                type="button"
                onClick={(e) => onMore(e.currentTarget)}
                aria-label={`More actions for ${title}`}
                className="-my-1 -mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-track"
              >
                <MoreHorizontal className="h-4.5 w-4.5" aria-hidden />
              </button>
            ) : null}
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {prayers.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  aria-pressed={p.status === "done" || p.status === "qada"}
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
                  className={`transition-token press-pop flex min-h-9 min-w-12 flex-col items-center justify-center rounded-full border-2 px-2.5 text-[12px] leading-tight font-medium select-none ${p.status === "open" && p.pending ? PENDING_STYLE[p.pending] : CHIP_STYLE[p.status]} ${
                    p.now ? "ring-2 ring-primary-strong ring-offset-1 ring-offset-surface" : ""
                  }`}
                >
                  <span>{p.label}</span>
                  {p.time ? <span className="text-[10.5px] font-normal opacity-80">{p.time}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {footer ? <div className="mt-2 border-t border-border pt-2">{footer}</div> : null}
    </section>
  );
}
