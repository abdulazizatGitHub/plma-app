"use client";

import {
  archiveItem,
  deleteItemTree,
  itemHistory,
  unarchiveItem,
  type DayEntry,
  type DayMark,
  type LogEntry,
} from "@life/shared";
import { Archive, ArrowLeft, Check, Circle, Flame, Pencil, Share2, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, createElement, useMemo, useState } from "react";
import { Button, ConfirmSheet, Heatmap, Tag, addDays, type HeatMark } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { SyncingNote } from "@/components/history/syncing-note";
import {
  MONTH_SHORT,
  PeriodCard,
  PeriodTabs,
  STAT_TONE,
  Stat,
  SummaryCard,
  WEEKDAY_SHORT,
  WeekDots,
  YearMonths,
  periodRange,
  periodTitle,
  rangeLabel,
  stepPeriod,
  utc,
  type DayDot,
  type MonthDot,
  type Period,
} from "@/components/history/period-ui";
import { ShareSheet, type ShareWhat } from "@/components/social/share-sheet";
import { DayEntryRow } from "@/components/today/day-entry-row";
import { PrayerInsightsPanel } from "@/components/prayer/insights-panel";
import { RowActionsMenu, type RowMenuTarget } from "@/components/today/row-actions-menu";
import { MosqueIcon } from "@/components/today/mosque-icon";
import { categoryIcon, categoryTone } from "@/lib/v2/category-style";
import { KIND_LABEL, scheduleSummary, trackingSummary } from "@/lib/v2/item-text";
import { useActions, useAllItems, useCategory, useClosedThrough, useDay, useHasSynced, useItem, useItemOccurrences, useUserSettings } from "@/lib/v2/use-day";
import { useToday } from "@/lib/v2/use-today";

/** Days of history behind the streak figures. */
const STATS_DAYS = 90;
/** Log lines shown before "Show all". */
const LOG_PREVIEW = 10;
const LONG_DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
const LONG_MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });
const LOG_DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const MARK_DOT: Record<string, string> = { done: "bg-done", partial: "bg-progress", missed: "bg-todo", skipped: "bg-track", today: "bg-primary" };
const MARK_WORD: Record<DayMark, string> = { done: "done", partial: "started", missed: "missed", skipped: "skipped", today: "today", not_due: "not due", future: "to come" };

/** One day of an item's log: what happened, with the value against the target it was logged with. */
function LogRow({ entry: l, unit }: { entry: LogEntry; unit: string }) {
  const fmt = (n: number) => n.toLocaleString("en-US");
  const amount = l.value !== null && unit ? `${fmt(l.value)}${l.target ? ` / ${fmt(l.target)}` : ""} ${unit}` : null;
  const what =
    l.mark === "done"
      ? (amount ?? "Done")
      : l.mark === "partial"
        ? (amount ?? "Started")
        : l.mark === "missed"
          ? amount && l.value
            ? `${amount} — missed`
            : "Missed"
          : l.mark === "skipped"
            ? l.how === "moved"
              ? `Moved${l.movedTo ? ` to ${LOG_DAY.format(utc(l.movedTo))}` : ""}`
              : "Skipped"
            : (amount ?? "Today");
  return (
    <li className="relative flex items-center gap-3 py-2.5 after:absolute after:right-0 after:bottom-0 after:left-5.5 after:h-px after:bg-border last:after:hidden">
      <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${MARK_DOT[l.mark] ?? "bg-track"}`} />
      <span className="w-28 shrink-0 text-[13px] text-ink-2">{LOG_DAY.format(utc(l.date))}</span>
      <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{what}</span>
      {l.qada ? <Tag tone="progress">Qada</Tag> : null}
      {l.late ? <Tag>Late</Tag> : null}
    </li>
  );
}

/** One item (Phase 3, HIS-01), in the Progress look (owner mockup, 2026-11-26): today's control, then its week, month or year. */
function ItemView() {
  const id = useSearchParams().get("id");
  const { item, children, ready } = useItem(id);
  const { items } = useAllItems();
  const category = useCategory(item?.categoryId ?? null);
  const run = useActions();
  const router = useRouter();
  const { notify } = useAddSheet();
  const today = useToday();
  const [kind, setKind] = useState<Period>("week");
  const [anchor, setAnchor] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menuFor, setMenuFor] = useState<RowMenuTarget>(null);
  const [allLog, setAllLog] = useState(false);

  const day = today ?? "1970-01-01";
  const at = anchor ?? day;
  const { weekStart } = useUserSettings();
  const range = periodRange(kind, at, weekStart);
  const { entries } = useDay(day);
  const statsFrom = addDays(day, -(STATS_DAYS - 1));
  const from = range.from < statsFrom ? range.from : statsFrom;
  const ids = useMemo(() => (item ? [item.id, ...children.map((c) => c.id)] : []), [item, children]);
  const occs = useItemOccurrences(ids, from, day);

  const closedThrough = useClosedThrough();
  const synced = useHasSynced();
  const [share, setShare] = useState<ShareWhat | null>(null);
  const history = useMemo(() => (item && today ? itemHistory(item, children, occs, range.from, range.to, today, closedThrough) : null), [item, children, occs, range.from, range.to, today, closedThrough]);
  const stats = useMemo(() => (item && today ? itemHistory(item, children, occs, statsFrom, today, today, closedThrough) : null), [item, children, occs, statsFrom, today, closedThrough]);

  if (!ready || !today) return <div className="skeleton h-40" aria-busy="true" aria-label="Loading item" />;
  if (!item || item.deletedAt) {
    return (
      <div className="card px-5 py-6 text-center">
        <p className="text-[14px] font-medium text-ink">This item doesn&apos;t exist anymore.</p>
        <Link href="/" className="mt-2 inline-block text-[13px] font-medium text-link">
          Back to Today
        </Link>
      </div>
    );
  }

  const prayers = item.meta.prayerSet === true;
  const days = history?.days ?? [];
  const marks = new Map<string, HeatMark>(days.map((d) => [d.date, d.mark]));
  const count = (m: DayMark) => days.filter((d) => d.mark === m).length;
  const log = (history?.log ?? []).filter((l) => l.mark !== "not_due" && l.mark !== "future");
  const unit = item.tracking.kind === "quantity" ? item.tracking.unit : item.tracking.kind === "duration" ? "min" : "";
  const entry: DayEntry | undefined = entries.find((e) => e.item.id === item.id && e.slot === "");
  const created = item.createdAt.slice(0, 10);
  const isCurrent = range.from <= today && today <= range.to;
  const subtitle = [category?.name ?? KIND_LABEL[item.type], scheduleSummary(item), trackingSummary(item), item.isOptional ? "Optional" : null, item.archivedAt ? "Archived" : null].filter(Boolean).join(" · ");

  const dots: DayDot[] = days.map((d) => {
    const label = WEEKDAY_SHORT.format(utc(d.date));
    const aria = `${LONG_DAY.format(utc(d.date))}: ${MARK_WORD[d.mark]}`;
    const state: DayDot["state"] =
      d.mark === "done" ? "done" : d.mark === "partial" ? "partial" : d.mark === "missed" ? "missed" : d.mark === "today" ? "today" : d.mark === "future" ? "future" : "free";
    return { date: d.date, label, state, pct: d.mark === "partial" ? 50 : 0, aria };
  });
  const months: MonthDot[] = Array.from({ length: 12 }, (_, i) => {
    const month = `${range.from.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`;
    const inMonth = days.filter((d) => d.date.startsWith(month));
    const done = inMonth.filter((d) => d.mark === "done").length;
    const due = inMonth.filter((d) => d.mark === "done" || d.mark === "missed" || d.mark === "partial").length;
    const pct = due ? Math.round((done / due) * 100) : null;
    const future = `${month}-01` > today;
    const name = LONG_MONTH.format(utc(`${month}-15`));
    return { month, label: MONTH_SHORT.format(utc(`${month}-15`)).slice(0, 1), pct, future, aria: future ? `${name}: to come` : pct === null ? `${name}: nothing due` : `${name}: ${pct}% done` };
  });

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
        className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
      </button>

      <header className="flex items-center gap-3.5">
        {category ? (
          <Link
            href={`/categories/view?id=${category.id}`}
            aria-label={`Open ${category.name}`}
            className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: `var(--cat-${categoryTone(category)})` }}
          >
            {createElement(categoryIcon(category), { className: "h-6 w-6 text-ink", strokeWidth: 1.75, "aria-hidden": true })}
          </Link>
        ) : (
          <span aria-hidden className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary-strong">
            {prayers ? <MosqueIcon className="h-6 w-6" /> : createElement(categoryIcon(undefined), { className: "h-6 w-6", strokeWidth: 1.75 })}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-[24px] leading-tight font-semibold text-ink">{item.title}</h1>
          <p className="text-[13.5px] text-ink-2">{subtitle}</p>
        </div>
      </header>

      <section aria-label="Today" className="space-y-2">
        <h2 className="text-[17px] font-semibold text-ink">Today</h2>
        {entry ? (
          <DayEntryRow entry={entry} date={today} category={category ?? undefined} onMore={(e, anchorEl) => setMenuFor({ entry: e, anchor: anchorEl })} />
        ) : (
          <p className="card px-4 py-3 text-[13.5px] text-ink-2">{item.archivedAt ? "Archived — not scheduled." : "Not scheduled today."}</p>
        )}
      </section>

      {prayers ? <PrayerInsightsPanel group={item} prayers={children.filter((c) => !c.deletedAt && !c.archivedAt)} today={today} /> : null}

      <div className="flex items-center justify-between gap-3 pt-1">
        <h2 className="text-[17px] font-semibold text-ink">Progress</h2>
        <PeriodTabs
          value={kind}
          onChange={(k) => {
            setKind(k);
            setAnchor(null);
            setAllLog(false);
          }}
        />
      </div>
      {synced === false ? <SyncingNote /> : null}

      {!prayers && stats ? (
        <SummaryCard pct={history?.completionRate ?? null} label={history?.completionRate == null ? "Nothing due yet" : `${history.completionRate}% done`}>
          <Stat icon={<Check strokeWidth={2.5} />} tone={STAT_TONE.done} value={count("done")} label="Done" />
          <Stat icon={<Circle />} tone={STAT_TONE.missed} value={count("missed")} label="Missed" />
          <Stat icon={<Flame />} tone={STAT_TONE.peach} value={`${stats.currentStreak} day${stats.currentStreak === 1 ? "" : "s"}`} label={`Streak · best ${stats.bestStreak}`} />
        </SummaryCard>
      ) : null}

      <PeriodCard
        label="History"
        title={periodTitle(kind, isCurrent)}
        range={rangeLabel(kind, range)}
        onStep={(dir) => {
          setAnchor(stepPeriod(kind, range, dir));
          setAllLog(false);
        }}
        canNext={!isCurrent && range.to < today}
        unit={kind}
      >
        {kind === "week" ? (
          <WeekDots days={dots} />
        ) : kind === "month" ? (
          <Heatmap month={range.from.slice(0, 7)} marks={marks} onMonth={(m) => setAnchor(`${m}-01`)} maxMonth={today.slice(0, 7)} minMonth={created.slice(0, 7)} weekStart={weekStart} />
        ) : (
          <YearMonths months={months} />
        )}
      </PeriodCard>

      {!prayers && stats && stats.currentStreak >= 2 ? (
        <button
          type="button"
          onClick={() => setShare({ kind: "item_streak", itemId: item.id, label: `your ${stats.currentStreak}-day ${item.title} streak` })}
          className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full text-[13.5px] font-medium text-link hover:bg-track"
        >
          <Share2 className="h-4 w-4" aria-hidden /> Share this streak with friends
        </button>
      ) : null}

      {log.length && !prayers ? (
        <section aria-label="Log" className="card px-4 py-3">
          <h2 className="mb-1 text-[17px] font-semibold text-ink">Log</h2>
          <ul>
            {(allLog ? log : log.slice(0, LOG_PREVIEW)).map((l) => (
              <LogRow key={l.date} entry={l} unit={unit} />
            ))}
          </ul>
          {log.length > LOG_PREVIEW && !allLog ? (
            <button type="button" onClick={() => setAllLog(true)} className="mt-1 min-h-9 w-full rounded-full text-[13px] font-medium text-link hover:bg-track">
              Show all {log.length}
            </button>
          ) : null}
          {history && (history.skipped || history.moved) ? (
            <p className="mt-1 text-[12px] text-ink-2">
              {history.skipped} skipped · {history.moved} moved — neither breaks a streak.
            </p>
          ) : null}
        </section>
      ) : null}

      {item.notes ? (
        <section aria-label="Notes" className="card px-4 py-3">
          <h2 className="mb-1 text-[17px] font-semibold text-ink">Notes</h2>
          <p className="text-[14px] whitespace-pre-wrap text-ink">{item.notes}</p>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => router.push(prayers ? "/settings/prayer" : `/items/edit?id=${item.id}`)}>
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
        </Button>
        {item.archivedAt ? (
          <Button size="sm" variant="secondary" onClick={() => void run((ctx) => unarchiveItem(item, items, ctx))}>
            <Undo2 className="h-3.5 w-3.5" aria-hidden /> Restore
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void run((ctx) => archiveItem(item, items, ctx));
              notify({ message: `Archived “${item.title}” — history kept` });
            }}
          >
            <Archive className="h-3.5 w-3.5" aria-hidden /> Archive
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setDeleting(true)}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
        </Button>
      </div>

      <ShareSheet what={share} onClose={() => setShare(null)} />
      <ConfirmSheet
        open={deleting}
        title={`Delete “${item.title}”?`}
        body={item.type === "group" ? "The routine and its sub-items are removed, with their history. Archive instead to keep it." : "It's removed with its history. Archive instead to keep it."}
        confirmLabel="Delete"
        onConfirm={() => {
          void run((ctx) => deleteItemTree(item, children, ctx));
          notify({ message: `Deleted “${item.title}”` });
          router.push(category ? `/categories/view?id=${category.id}` : "/");
        }}
        onClose={() => setDeleting(false)}
      />
      <RowActionsMenu key={menuFor?.entry.key ?? "none"} target={menuFor} date={today} today={today} onClose={() => setMenuFor(null)} />
    </div>
  );
}

export default function ItemViewPage() {
  return (
    <Suspense fallback={<div className="skeleton h-40" aria-busy="true" aria-label="Loading item" />}>
      <ItemView />
    </Suspense>
  );
}
