import { MoreHorizontal } from "lucide-react";
import { Ring, type RingSegment } from "./ring";

export type PrayerChipStatus = RingSegment;

export type PrayerChip = {
  key: string;
  label: string;
  status: PrayerChipStatus;
  /** Optional local time, e.g. "1:15 PM". */
  time?: string;
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

type PrayerRowProps = {
  title?: string;
  prayers: PrayerChip[];
  /** One tap: open ↔ prayed. Any prayer, any order. */
  onToggle?: (key: string) => void;
  /** Missed / Qada / Undo menu (visible twin of long-press). */
  onMore?: () => void;
};

/** The daily prayer block: segmented ring + one chip per prayer (owner S14–S15). */
export function PrayerRow({ title = "Daily prayers", prayers, onToggle, onMore }: PrayerRowProps) {
  const prayed = prayers.filter((p) => p.status === "done" || p.status === "qada").length;
  return (
    <section className="card flex items-center gap-3 p-3" aria-label={title}>
      <Ring
        label={`${prayed} of ${prayers.length} prayers prayed`}
        segments={prayers.map((p) => p.status)}
        size={52}
        stroke={6}
      >
        <span className="text-[13px] font-semibold text-ink">
          {prayed}/{prayers.length}
        </span>
      </Ring>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-[14px] font-medium text-ink">{title}</h3>
          {onMore ? (
            <button
              type="button"
              onClick={onMore}
              aria-label={`More actions for ${title}`}
              className="-my-2 -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:bg-track"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {prayers.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                aria-pressed={p.status === "done" || p.status === "qada"}
                aria-label={`${p.label}, ${STATUS_WORD[p.status]}`}
                onClick={() => onToggle?.(p.key)}
                className={`transition-token press-pop flex min-h-9 min-w-12 flex-col items-center justify-center rounded-full border-2 px-2.5 text-[12px] leading-tight font-medium ${CHIP_STYLE[p.status]}`}
              >
                <span>{p.label}</span>
                {p.time ? <span className="text-[11px] font-normal opacity-80">{p.time}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
