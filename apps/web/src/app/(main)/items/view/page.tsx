"use client";

import {
  archiveItem,
  dateRange,
  deleteItemTree,
  itemHistory,
  todayLocalDate,
  unarchiveItem,
  type DayEntry,
  type Occurrence,
} from "@life/shared";
import { Archive, ArrowLeft, CircleCheck, Flame, Pencil, Trash2, Trophy, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, createElement, useEffect, useMemo, useState, type ReactNode } from "react";
import { Bars, Button, ConfirmSheet, Heatmap, Tag, addDays, type HeatMark } from "@/components/kit";
import { useAddSheet } from "@/components/providers/add-sheet-provider";
import { DayEntryRow } from "@/components/today/day-entry-row";
import { PrayerInsightsPanel } from "@/components/prayer/insights-panel";
import { RowActionsMenu, type RowMenuTarget } from "@/components/today/row-actions-menu";
import { categoryIcon, categoryTone } from "@/lib/v2/category-style";
import { KIND_LABEL, scheduleSummary, trackingSummary } from "@/lib/v2/item-text";
import { useActions, useAllItems, useCategory, useDay, useItem, useItemOccurrences } from "@/lib/v2/use-day";

/** Days of history behind the streak and completion figures. */
const STATS_DAYS = 90;
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "narrow", timeZone: "UTC" });

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="card flex flex-col gap-0.5 px-3 py-2.5">
      <span className="flex items-center gap-1 text-[11px] text-ink-2">
        <span aria-hidden className="[&>svg]:h-3.5 [&>svg]:w-3.5">
          {icon}
        </span>
        {label}
      </span>
      <span className="text-lg font-semibold text-ink">{value}</span>
    </div>
  );
}

/** Value logged on a day, for the 7-day bars (counts and minutes), or 1 / 0.5 for done / started. */
function barValue(occs: Occurrence[], date: string, mark: HeatMark, measured: boolean): number {
  if (measured) return occs.find((o) => o.date === date && o.slot === "")?.value ?? 0;
  return mark === "done" ? 1 : mark === "partial" ? 0.5 : 0;
}

/** One item: today's control, schedule, history heatmap, 7-day bars, streaks (Phase 3, HIS-01 basic). */
function ItemView() {
  const id = useSearchParams().get("id");
  const { item, children, ready } = useItem(id);
  const { items } = useAllItems();
  const category = useCategory(item?.categoryId ?? null);
  const run = useActions();
  const router = useRouter();
  const { notify } = useAddSheet();
  const [today, setToday] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menuFor, setMenuFor] = useState<RowMenuTarget>(null);
  useEffect(() => {
    const t = todayLocalDate();
    setToday(t); // eslint-disable-line react-hooks/set-state-in-effect -- client-only date
    setMonth(t.slice(0, 7));
  }, []);

  const day = today ?? "1970-01-01";
  const { entries } = useDay(day);
  const statsFrom = addDays(day, -(STATS_DAYS - 1));
  const monthFrom = `${month ?? day.slice(0, 7)}-01`;
  const from = monthFrom < statsFrom ? monthFrom : statsFrom;
  const ids = useMemo(() => (item ? [item.id, ...children.map((c) => c.id)] : []), [item, children]);
  const occs = useItemOccurrences(ids, from, day);

  const history = useMemo(() => (item && today ? itemHistory(item, children, occs, from, today, today) : null), [item, children, occs, from, today]);

  if (!ready || !today || !month) return <div className="skeleton h-40" aria-busy="true" aria-label="Loading item" />;
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

  const marks = new Map<string, HeatMark>((history?.days ?? []).map((d) => [d.date, d.mark]));
  const stats = history ? itemHistory(item, children, occs, statsFrom, today, today) : null;
  const week = dateRange(addDays(today, -6), today);
  const measured = item.tracking.kind === "quantity" || item.tracking.kind === "duration";
  const values = week.map((d) => barValue(occs, d, marks.get(d) ?? "not_due", measured));
  const entry: DayEntry | undefined = entries.find((e) => e.item.id === item.id && e.slot === "");
  const tracking = trackingSummary(item);
  const created = item.createdAt.slice(0, 7);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
        className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back
      </button>

      <header className="space-y-1.5">
        <h1 className="text-xl font-semibold text-ink">{item.title}</h1>
        <div className="flex flex-wrap gap-1">
          <Tag>{KIND_LABEL[item.type]}</Tag>
          {category ? (
            <Link href={`/categories/view?id=${category.id}`}>
              <Tag color={`var(--cat-${categoryTone(category)})`} icon={createElement(categoryIcon(category))}>
                {category.name}
              </Tag>
            </Link>
          ) : null}
          <Tag>{scheduleSummary(item)}</Tag>
          {tracking ? <Tag>{tracking}</Tag> : null}
          {item.isOptional ? <Tag>Optional</Tag> : null}
          {item.archivedAt ? <Tag tone="progress">Archived</Tag> : null}
        </div>
      </header>

      <section aria-label="Today" className="space-y-1.5">
        <h2 className="text-[15px] font-semibold text-ink">Today</h2>
        {entry ? (
          <DayEntryRow entry={entry} date={today} category={category ?? undefined} onMore={(e, anchor) => setMenuFor({ entry: e, anchor })} />
        ) : (
          <p className="card px-3 py-2.5 text-[13px] text-ink-2">{item.archivedAt ? "Archived — not scheduled." : "Not scheduled today."}</p>
        )}
      </section>

      {item.meta.prayerSet === true ? <PrayerInsightsPanel group={item} prayers={children.filter((c) => !c.deletedAt && !c.archivedAt)} today={today} /> : null}

      {stats && item.meta.prayerSet !== true ? (
        <section aria-label="Stats" className="grid grid-cols-3 gap-2">
          <Stat icon={<Flame />} label="Streak" value={`${stats.currentStreak} day${stats.currentStreak === 1 ? "" : "s"}`} />
          <Stat icon={<Trophy />} label="Best" value={`${stats.bestStreak}`} />
          <Stat icon={<CircleCheck />} label={`Done · ${STATS_DAYS}d`} value={stats.completionRate === null ? "—" : `${stats.completionRate}%`} />
        </section>
      ) : null}

      <section aria-label="Last 7 days" className="card space-y-2 p-3.5">
        <h2 className="text-[13px] font-semibold text-ink">Last 7 days</h2>
        <Bars
          label={`${item.title}, last 7 days`}
          values={values}
          labels={week.map((d) => WEEKDAY.format(new Date(`${d}T00:00:00Z`)))}
          max={measured ? (item.tracking.kind === "quantity" ? item.tracking.target : item.tracking.kind === "duration" ? item.tracking.targetMin : undefined) : 1}
          highlight={6}
          height={56}
        />
      </section>

      <section aria-label="History" className="card p-3.5">
        <Heatmap month={month} marks={marks} onMonth={setMonth} maxMonth={today.slice(0, 7)} minMonth={created} />
      </section>

      {item.notes ? (
        <section aria-label="Notes" className="card p-3.5">
          <h2 className="mb-1 text-[13px] font-semibold text-ink">Notes</h2>
          <p className="text-[13px] whitespace-pre-wrap text-ink">{item.notes}</p>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" onClick={() => router.push(item.meta.prayerSet === true ? "/settings/prayer" : `/items/edit?id=${item.id}`)}>
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
