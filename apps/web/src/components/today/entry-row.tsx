"use client";

import {
  checklistSteps,
  describeSchedule,
  entryState,
  entryWindow,
  inWindow,
  normalisePrayerKey,
  prayerKeyOf,
  clockIn,
  setDuration,
  setQuantity,
  toggleChecklistStep,
  toggleDone,
  type Category,
  type DayEntry,
} from "@life/shared";
import { AlertTriangle, CalendarClock, Check, ChevronDown, Clock3, Flag, ListChecks, Moon, Play, Repeat2, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { QuantityRow, Tag, TaskRow, type ItemState } from "@/components/kit";
import { categoryIcon, categoryTone, formatTime } from "@/lib/v2/category-style";
import { shortDate } from "@/lib/v2/dates";
import { useActions, usePrayerSet, usePrayerTimes } from "@/lib/v2/use-day";
import { useNow } from "@/lib/v2/use-now";

const fmt = (n: number) => n.toLocaleString("en-US");
const PRAYER_NAME: Record<string, string> = { fajr: "Fajr", sunrise: "Sunrise", dhuhr: "Zuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };
const localDateOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Plain-text caption (used where tags don't fit, e.g. menus and tests). */
export function entryCaption(entry: DayEntry, category: Category | undefined): string | undefined {
  const movedFrom = entry.occurrence?.movedFrom;
  const parts = [category?.name, describeSchedule(entry.item), movedFrom ? `moved from ${shortDate(movedFrom)}` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

/** The tag line under a row title: category, time, progress, priority, schedule, history. */
function entryTags(entry: DayEntry, category?: Category, dueLabel?: string, when?: string): ReactNode[] {
  const item = entry.item;
  const o = entry.occurrence;
  const t = item.tracking;
  const time = item.schedule.kind === "once" ? item.schedule.time : undefined;
  // The anchor gets its own "when" tag, so the repeat tag shows just the days.
  const repeat = item.schedule.kind !== "once" ? describeSchedule({ schedule: { ...item.schedule, anchor: undefined } }) : null;
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
  if (when) tags.push(<Tag key="when" icon={<Moon />}>{when}</Tag>);
  if (t.kind === "quantity") {
    tags.push(
      <Tag key="qty">
        {fmt(o?.value ?? 0)}
        {t.target ? ` / ${fmt(t.target)}` : ""} {t.unit}
      </Tag>,
    );
  }
  if (t.kind === "duration") {
    tags.push(
      <Tag key="dur" icon={<Timer />}>
        {o?.value ?? 0}
        {t.targetMin ? ` / ${t.targetMin}` : ""} min
      </Tag>,
    );
  }
  if (t.kind === "checklist") {
    tags.push(
      <Tag key="steps" icon={<ListChecks />}>
        {checklistSteps(entry).filter(Boolean).length}/{t.steps.length} steps
      </Tag>,
    );
  }
  if (item.priority === "critical") tags.push(<Tag key="pri" tone="todo" icon={<Flag />}>Critical</Tag>);
  else if (item.priority === "high") tags.push(<Tag key="pri" tone="progress" icon={<Flag />}>High</Tag>);
  if (o?.status === "in_progress" && o.startedAt && t.kind !== "quantity" && t.kind !== "duration") {
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

/**
 * Checklists left open, by day + entry. A tick moves the row to another section
 * (To Do → In Progress), which remounts it; this keeps it open across the move.
 */
const openChecklists = new Set<string>();

/** The checklist's steps as small tick rows (TRK-04). */
function ChecklistSteps({ entry, date }: { entry: DayEntry; date: string }) {
  const run = useActions();
  const t = entry.item.tracking;
  if (t.kind !== "checklist") return null;
  const ticks = checklistSteps(entry);
  return (
    <ul className="mt-1.5 space-y-0.5" aria-label={`${entry.item.title} steps`}>
      {t.steps.map((step, i) => (
        <li key={i}>
          <button
            type="button"
            role="checkbox"
            aria-checked={ticks[i]}
            onClick={() => void run((ctx) => toggleChecklistStep(entry, date, i, ctx))}
            className="flex min-h-8 w-full items-center gap-2 rounded-lg px-1 text-left text-[13px] text-ink hover:bg-track"
          >
            <span
              aria-hidden
              className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-[5px] border ${ticks[i] ? "border-done bg-done text-on-fill" : "border-border"}`}
            >
              {ticks[i] ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            <span className={ticks[i] ? "text-ink-2 line-through" : ""}>{step}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * One row on Today: quantity and duration items get the stepper, checklists
 * expand to their steps, everything else is the one-tap check. Tapping the
 * title opens the item.
 */
export function EntryRow({ entry, date, category, onMore, dueLabel }: EntryRowProps) {
  const run = useActions();
  const router = useRouter();
  const openKey = `${date}|${entry.key}`;
  const [showSteps, setShowStepsState] = useState(() => openChecklists.has(openKey));
  const setShowSteps = (update: (v: boolean) => boolean) =>
    setShowStepsState((v) => {
      const next = update(v);
      if (next) openChecklists.add(openKey);
      else openChecklists.delete(openKey);
      return next;
    });
  const open = () => router.push(`/items/view?id=${entry.item.id}`);
  const state = entryState(entry);
  const visible: ItemState = state === "not_today" ? "todo" : state;
  const t = entry.item.tracking;
  const times = usePrayerTimes(date);
  const now = useNow();
  const { prayers } = usePrayerSet();
  const s = entry.item.schedule;
  const anchor = s.kind !== "once" ? s.anchor : undefined;
  const slot = anchor && times ? entryWindow(entry, times) : null;
  let when: string | undefined;
  if (anchor && slot && times) {
    const range = `${formatTime(clockIn(slot.start, times.timezone))}–${formatTime(clockIn(slot.end, times.timezone))}`;
    if (anchor.type === "prayer") {
      const key = normalisePrayerKey(anchor.prayer);
      const name = prayers.find((p) => normalisePrayerKey(prayerKeyOf(p) ?? "") === key)?.title ?? PRAYER_NAME[key] ?? key;
      when = `${anchor.relation[0].toUpperCase()}${anchor.relation.slice(1)} ${name} · ${range}`;
    } else when = range;
  }
  const highlight = Boolean(slot && inWindow(now, slot) && entryState(entry) !== "done" && times?.date === localDateOf(now));
  const list = entryTags(entry, category, dueLabel, when);
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
        onOpen={open}
        highlight={highlight}
        onMore={(anchor) => onMore(entry, anchor)}
      />
    );
  }
  if (t.kind === "duration") {
    return (
      <QuantityRow
        title={entry.item.title}
        tags={tags}
        value={entry.occurrence?.value ?? 0}
        onChange={(v) => void run((ctx) => setDuration(entry, date, v, ctx))}
        step={5}
        target={t.targetMin}
        unit="min"
        priority={entry.item.priority}
        onOpen={open}
        highlight={highlight}
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
      onOpen={open}
      highlight={highlight}
      onMore={(anchor) => onMore(entry, anchor)}
    >
      {t.kind === "checklist" ? (
        <>
          <button
            type="button"
            aria-expanded={showSteps}
            onClick={() => setShowSteps((v) => !v)}
            className="mt-0.5 flex min-h-7 items-center gap-1 text-[12px] font-medium text-link"
          >
            {showSteps ? "Hide steps" : "Show steps"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showSteps ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {showSteps ? <ChecklistSteps entry={entry} date={date} /> : null}
        </>
      ) : null}
    </TaskRow>
  );
}
