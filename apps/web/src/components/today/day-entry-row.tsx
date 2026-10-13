"use client";

import { entryState, isPrayerGroup, type Category, type DayEntry, type EntryState } from "@life/shared";
import { ArrowRight, ChevronDown, ListChecks, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { createElement, useId, useState } from "react";
import { Ring, Tag } from "@/components/kit";
import { categoryIcon, categoryTone } from "@/lib/v2/category-style";
import { EntryRow } from "./entry-row";
import { PrayerGroup } from "./prayer-group";

type RowProps = {
  entry: DayEntry;
  date: string;
  category?: Category;
  onMore: (entry: DayEntry, anchor: HTMLElement) => void;
  dueLabel?: string;
  onInteract?: () => void;
  movingTo?: EntryState;
  /** Inside a grouped list card (Today). */
  compact?: boolean;
  hideCategory?: boolean;
};

/**
 * A routine ("Gym — Push day"): a card with its progress that expands to its
 * sub-items. It completes when every sub-item is done (ITM-03).
 */
export function GroupRow({ entry, date, category, onMore, onInteract, movingTo, compact, hideCategory }: RowProps) {
  const children = entry.children ?? [];
  const counted = children.filter((c) => entryState(c) !== "not_today");
  const done = counted.filter((c) => entryState(c) === "done").length;
  const complete = entryState(entry) === "done";
  const [open, setOpen] = useState(!complete);
  const panelId = useId();
  return (
    <section className={compact ? "overflow-hidden" : "card overflow-hidden"} aria-label={entry.item.title}>
      <div className="flex items-center gap-1 pr-1.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left"
        >
          <Ring label={`${entry.item.title}: ${done} of ${counted.length} done`} value={counted.length ? (done / counted.length) * 100 : 0} size={28} stroke={4} />
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[14px] font-medium ${complete ? "text-ink-2 line-through" : "text-ink"}`}>{entry.item.title}</span>
            <span className="mt-1 flex flex-wrap gap-1">
              {movingTo ? (
                <Tag tone="primary" icon={<ArrowRight />}>
                  {movingTo === "done" ? "Done" : movingTo === "in_progress" ? "In Progress" : movingTo === "todo" ? "To Do" : "Not today"}
                </Tag>
              ) : null}
              <Tag icon={<ListChecks />} tone={complete ? "done" : "neutral"}>
                {done}/{counted.length}
              </Tag>
              {category && !hideCategory ? (
                <Tag color={`var(--cat-${categoryTone(category)})`} icon={createElement(categoryIcon(category))}>
                  {category.name}
                </Tag>
              ) : null}
            </span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-ink-2 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`More actions for ${entry.item.title}`}
          onClick={(e) => onMore(entry, e.currentTarget)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-track hover:text-ink"
        >
          <MoreHorizontal className="h-4.5 w-4.5" aria-hidden />
        </button>
      </div>
      {open ? (
        <div id={panelId} className={compact ? "divide-y divide-border border-t border-border bg-bg/40 pl-6" : "space-y-1.5 bg-bg/60 p-2 pt-0"}>
          {children.map((c) => (
            <EntryRow key={c.key} entry={c} date={date} onMore={onMore} onInteract={onInteract} compact={compact} hideCategory />
          ))}
          <Link href={`/items/view?id=${entry.item.id}`} className={`flex min-h-8 items-center text-[12px] font-medium text-link ${compact ? "px-3" : "px-1"}`}>
            Open routine
          </Link>
        </div>
      ) : null}
    </section>
  );
}

/** Picks the right row: prayer chips, a routine card, or a single item. */
export function DayEntryRow(props: RowProps) {
  const { entry, date } = props;
  if (entry.children) {
    return isPrayerGroup(entry.item) ? <PrayerGroup entry={entry} date={date} /> : <GroupRow {...props} />;
  }
  return <EntryRow {...props} />;
}
