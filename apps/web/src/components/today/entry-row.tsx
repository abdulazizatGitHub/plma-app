"use client";

import { describeSchedule, entryState, setQuantity, toggleDone, type Category, type DayEntry } from "@life/shared";
import { AlertTriangle, CalendarClock, Clock3, Flag, Play, Repeat2 } from "lucide-react";
import type { ReactNode } from "react";
import { QuantityRow, Tag, TaskRow, type ItemState } from "@/components/kit";
import { categoryIcon, categoryTone, formatTime } from "@/lib/v2/category-style";
import { shortDate } from "@/lib/v2/dates";
import { useActions } from "@/lib/v2/use-day";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Plain-text caption (used where tags don't fit, e.g. menus and tests). */
export function entryCaption(entry: DayEntry, category: Category | undefined): string | undefined {
  const movedFrom = entry.occurrence?.movedFrom;
  const parts = [category?.name, describeSchedule(entry.item), movedFrom ? `moved from ${shortDate(movedFrom)}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

/** The tag line under a row title: category, time, progress, priority, schedule, history. */
function entryTags(entry: DayEntry, category?: Category, dueLabel?: string): ReactNode[] {
  const item = entry.item;
  const o = entry.occurrence;
  const t = item.tracking;
  const time = item.schedule.kind === "once" ? item.schedule.time : undefined;
  const repeat = item.schedule.kind !== "once" ? describeSchedule(item) : null;
  const Icon = categoryIcon(category);
  const tags: ReactNode[] = [];
  if (dueLabel) tags.push(<Tag key="due" tone="todo" icon={<AlertTriangle />}>{dueLabel}</Tag>);
  if (category) {
    tags.push(
      <Tag key="cat" color={`var(--cat-${categoryTone(category)})`} icon={<Icon />}>
        {category.name}
      </Tag>,
    );
  }
  if (time) tags.push(<Tag key="time" icon={<Clock3 />}>{formatTime(time)}</Tag>);
  if (t.kind === "quantity") {
    tags.push(
      <Tag key="qty">
        {fmt(o?.value ?? 0)}
        {t.target ? ` / ${fmt(t.target)}` : ""} {t.unit}
      </Tag>,
    );
  }
  if (item.priority === "critical") tags.push(<Tag key="pri" tone="todo" icon={<Flag />}>Critical</Tag>);
  else if (item.priority === "high") tags.push(<Tag key="pri" tone="progress" icon={<Flag />}>High</Tag>);
  if (o?.status === "in_progress" && o.startedAt && t.kind !== "quantity") {
    const d = new Date(o.startedAt);
    tags.push(<Tag key="started" icon={<Play />}>Started {formatTime(`${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`)}</Tag>);
  }
  if (repeat) tags.push(<Tag key="repeat" icon={<Repeat2 />}>{repeat}</Tag>);
  if (o?.movedFrom) tags.push(<Tag key="moved" icon={<CalendarClock />}>From {shortDate(o.movedFrom)}</Tag>);
  return tags;
}

type EntryRowProps = {
  entry: DayEntry;
  /** The day this entry belongs to (actions write to that day). */
  date: string;
  category?: Category;
  onMore: (entry: DayEntry, anchor: HTMLElement) => void;
  /** Shown as a red tag, e.g. "Was due Fri 9 Oct" (Overdue list). */
  dueLabel?: string;
};

/** A task row: quantity items get the stepper, everything else the one-tap check. */
export function EntryRow({ entry, date, category, onMore, dueLabel }: EntryRowProps) {
  const run = useActions();
  const state = entryState(entry);
  const visible: ItemState = state === "not_today" ? "todo" : state;
  const t = entry.item.tracking;
  const list = entryTags(entry, category, dueLabel);
  const tags = list.length ? list : undefined;

  if (t.kind === "quantity") {
    return (
      <QuantityRow
        title={entry.item.title}
        tags={tags}
        value={entry.occurrence?.value ?? 0}
        onChange={(v) => void run((ctx) => setQuantity(entry, date, v, ctx))}
        step={t.step}
        target={t.target}
        unit={t.unit}
        priority={entry.item.priority}
        onMore={(anchor) => onMore(entry, anchor)}
      />
    );
  }
  return (
    <TaskRow
      title={entry.item.title}
      tags={tags}
      state={visible}
      priority={entry.item.priority}
      onToggle={() => void run((ctx) => toggleDone(entry, date, ctx))}
      onMore={(anchor) => onMore(entry, anchor)}
    />
  );
}
