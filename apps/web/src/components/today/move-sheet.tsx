"use client";

import { moveTo, type DayEntry } from "@life/shared";
import { Calendar, DateChips, Sheet, dateLabel } from "@/components/kit";
import { useActions } from "@/lib/v2/use-day";

/**
 * "Move to a date…" (owner, 2026-10-13): quick chips and a calendar in the
 * app's own look; one tap on a day moves the task there.
 */
export function MoveSheet({
  entry,
  from,
  today,
  onClose,
  onMoved,
}: {
  entry: DayEntry | null;
  /** The day it's on now. */
  from: string;
  today: string;
  onClose: () => void;
  onMoved: (to: string) => void;
}) {
  const run = useActions();
  const move = (to: string) => {
    if (!entry || to === from) return onClose();
    void run((ctx) => moveTo(entry, from, to, ctx));
    onClose();
    onMoved(to);
  };
  return (
    <Sheet open={entry !== null} onClose={onClose} title={entry ? `Move · ${entry.item.title}` : "Move"}>
      {entry ? (
        <div className="space-y-3">
          <p className="text-[12.5px] text-ink-2">Now on {dateLabel(from)}. Tap a day to move it there.</p>
          <DateChips today={today} min={today} onPick={move} />
          <Calendar value={from} onChange={move} today={today} min={today} />
        </div>
      ) : null}
    </Sheet>
  );
}
