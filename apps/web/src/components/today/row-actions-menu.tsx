"use client";

import { canLog, dayAccess, deleteItemTree, entryState, isPrayerGroup, moveTo, removeStep, skip, start, toggleDone, type DayEntry, type ItemDependency } from "@life/shared";
import { ArrowRight, CalendarClock, CalendarDays, ExternalLink, Pencil, Play, RotateCcw, SkipForward, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, PopoverMenu, PopoverMenuDivider, PopoverMenuItem, addDays } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { useStore } from "@/components/providers/store-provider";
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
  const { store } = useStore();
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(addDays(today, 2));

  if (!target) return null;
  const { entry, anchor } = target;
  const date = target.date ?? screenDate;
  const oneOff = entry.item.schedule.kind === "once";
  const isGroup = Boolean(entry.children);
  const prayers = isPrayerGroup(entry.item);
  // A repeating routine's moved copy wouldn't carry its sub-items, so routines skip instead.
  const canMove = !isGroup || oneOff;
  const quickEdit = oneOff && !isGroup && entry.item.tracking.kind === "check";
  const from = date ?? today;
  const state = date ? entryState(entry) : "todo";
  // Status changes only on days that can be logged; future days can still be skipped or moved.
  const access = date ? dayAccess(date, today) : "live";
  const logging = canLog(access);
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
          {logging && state === "todo" && !isGroup && entry.item.tracking.kind !== "quantity" && entry.item.tracking.kind !== "duration" ? (
            <PopoverMenuItem icon={<Play />} label="Mark started" onClick={() => act((ctx) => start(entry, date, ctx))} />
          ) : null}
          {logging && state === "done" && !isGroup ? (
            <PopoverMenuItem icon={<RotateCcw />} label="Mark not done" onClick={() => act((ctx) => toggleDone(entry, date, ctx))} />
          ) : null}
          {access !== "history" ? (
          <PopoverMenuItem
            icon={<SkipForward />}
            label={access === "planned" ? "Skip that day" : "Skip today"}
            onClick={() =>
              act(async (ctx) => [
                ...(await skip(entry, date, ctx)),
                ...(await Promise.all((entry.children ?? []).map((c) => skip(c, date, ctx)))).flat(),
              ])
            }
          />
          ) : null}
          {canMove ? (
            from < today ? (
              <PopoverMenuItem icon={<ArrowRight />} label="Move to today" onClick={() => moveAction(today)} />
            ) : (
              <PopoverMenuItem icon={<ArrowRight />} label="Move to tomorrow" onClick={() => moveAction(addDays(from, 1))} />
            )
          ) : null}
        </>
      )}
      {canMove ? <PopoverMenuItem icon={<CalendarDays />} label="Move to a date…" onClick={() => setPicking((p) => !p)} /> : null}
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
      <PopoverMenuDivider />
      <PopoverMenuItem
        icon={<ExternalLink />}
        label="Details & history"
        onClick={() => {
          onClose();
          router.push(`/items/view?id=${entry.item.id}`);
        }}
      />
      {!prayers ? (
        <>
          <PopoverMenuItem
            icon={<Pencil />}
            label="Edit"
            onClick={() => {
              onClose();
              if (quickEdit) openEdit(entry.item);
              else router.push(`/items/edit?id=${entry.item.id}`);
            }}
          />
          {oneOff ? (
            <PopoverMenuItem
              icon={<Trash2 />}
              label="Delete"
              tone="danger"
              onClick={() =>
                act((ctx) => {
                  // A plan step takes its "waits for" links with it.
                  if (entry.plan && store) {
                    const deps = store.query("itemDependencies", `WHERE ("item_id" = ? OR "depends_on_id" = ?) AND "deleted_at" IS NULL`, [entry.item.id, entry.item.id]) as unknown as ItemDependency[];
                    return removeStep(entry.item, deps, ctx);
                  }
                  return deleteItemTree(entry.item, (entry.children ?? []).map((c) => c.item), ctx);
                })
              }
            />
          ) : null}
        </>
      ) : null}
    </PopoverMenu>
  );
}
