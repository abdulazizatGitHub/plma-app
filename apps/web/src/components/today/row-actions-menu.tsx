"use client";

import { deleteItem, entryState, moveTo, skip, start, toggleDone, type DayEntry } from "@life/shared";
import { ArrowRight, CalendarClock, CalendarDays, Pencil, Play, RotateCcw, SkipForward, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, PopoverMenu, PopoverMenuDivider, PopoverMenuItem, addDays } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { isoDate } from "@/lib/forms/validators";
import { useActions } from "@/lib/v2/use-day";

/** Which row's menu is open, and the element it is anchored to. */
export type RowMenuTarget = {
  entry: DayEntry;
  anchor: HTMLElement;
  /** The entry's own day when it differs from the screen's (Upcoming / Overdue rows). */
  date?: string;
} | null;

type RowActionsMenuProps = {
  target: RowMenuTarget;
  /** The day the entry is on; null for Pending items. */
  date: string | null;
  today: string;
  onClose: () => void;
};

/**
 * Skip / move / pending / edit for one row (FLX-01…03), as a compact popup
 * next to the row's ⋯ (owner feedback: the bottom sheet was too big).
 * For Pending items it offers scheduling instead.
 */
export function RowActionsMenu({ target, date: screenDate, today, onClose }: RowActionsMenuProps) {
  const run = useActions();
  const { openEdit } = useAddSheet();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(addDays(today, 2));

  if (!target) return null;
  const { entry, anchor } = target;
  const date = target.date ?? screenDate;
  const oneOff = entry.item.schedule.kind === "once";
  const isTask = entry.item.type === "task";
  const from = date ?? today;
  const state = date ? entryState(entry) : "todo";
  const act = (build: Parameters<typeof run>[0]) => {
    void run(build);
    onClose();
  };
  const moveAction = (to: string | null) => act((ctx) => moveTo(entry, from, to, ctx));

  return (
    <PopoverMenu anchor={anchor} onClose={onClose} label={entry.item.title}>
      {date === null ? (
        <>
          <PopoverMenuItem icon={<CalendarDays />} label="Do it today" onClick={() => moveAction(today)} />
          <PopoverMenuItem icon={<ArrowRight />} label="Tomorrow" onClick={() => moveAction(addDays(today, 1))} />
        </>
      ) : (
        <>
          {state === "todo" && entry.item.tracking.kind !== "quantity" ? (
            <PopoverMenuItem icon={<Play />} label="Mark started" onClick={() => act((ctx) => start(entry, date, ctx))} />
          ) : null}
          {state === "done" ? (
            <PopoverMenuItem icon={<RotateCcw />} label="Mark not done" onClick={() => act((ctx) => toggleDone(entry, date, ctx))} />
          ) : null}
          <PopoverMenuItem icon={<SkipForward />} label="Skip today" onClick={() => act((ctx) => skip(entry, date, ctx))} />
          <PopoverMenuItem icon={<ArrowRight />} label="Move to tomorrow" onClick={() => moveAction(addDays(from, 1))} />
        </>
      )}
      <PopoverMenuItem icon={<CalendarDays />} label="Move to a date…" onClick={() => setPicking((p) => !p)} />
      {picking ? (
        <div role="group" aria-label="Pick a date" className="flex gap-2 px-2 pb-1.5">
          <input
            type="date"
            aria-label="Move to date"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-[10px] border border-border bg-surface px-2 text-[14px] text-ink"
          />
          <Button disabled={isoDate(picked) !== null} onClick={() => moveAction(picked)} className="min-h-10 px-3">
            Move
          </Button>
        </div>
      ) : null}
      {oneOff && date !== null ? (
        <PopoverMenuItem icon={<CalendarClock />} label="Mark pending (no date)" onClick={() => moveAction(null)} />
      ) : null}
      {isTask ? (
        <>
          <PopoverMenuDivider />
          <PopoverMenuItem
            icon={<Pencil />}
            label="Edit"
            onClick={() => {
              onClose();
              openEdit(entry.item);
            }}
          />
          <PopoverMenuItem icon={<Trash2 />} label="Delete task" tone="danger" onClick={() => act((ctx) => deleteItem(entry.item, ctx))} />
        </>
      ) : null}
    </PopoverMenu>
  );
}
